-- PREVIEW PROPOSAL ONLY. NOT EXECUTED AGAINST SUPABASE.
-- Supabase Postgres is the source of truth. One durable row per org/event.
-- Existing webhook_events.dedupe_key has a UNIQUE constraint: insert with
-- ON CONFLICT (dedupe_key) DO NOTHING RETURNING id; never SELECT-then-INSERT.

create table public.integration_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  dedupe_key text not null check (length(dedupe_key) between 1 and 512),
  event_type text not null check (length(event_type) between 1 and 80),
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending','processing','processed','retry','dead')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 8 check (max_attempts between 1 and 20),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  lock_token uuid,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (organization_id, dedupe_key),
  check (
    (status = 'processing' and locked_at is not null and lock_token is not null)
    or
    (status <> 'processing' and locked_at is null and lock_token is null)
  )
);

create index integration_outbox_ready_idx
  on public.integration_outbox (available_at, created_at)
  where status in ('pending','retry');
create index integration_outbox_lease_idx
  on public.integration_outbox (locked_at)
  where status = 'processing';

alter table public.integration_outbox enable row level security;
revoke all on public.integration_outbox from anon, authenticated;
grant select, insert, update, delete on public.integration_outbox to service_role;

-- Atomic multi-consumer claim. SKIP LOCKED prevents workers claiming the same row.
-- Attempts count claims, not failures. Expired final attempts are moved to dead.
create or replace function public.claim_integration_outbox(p_limit integer default 20)
returns setof public.integration_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'INVALID_BATCH_SIZE';
  end if;

  update public.integration_outbox o
     set status = 'dead',
         locked_at = null,
         lock_token = null,
         last_error = coalesce(o.last_error, 'LEASE_EXPIRED_MAX_ATTEMPTS')
   where o.status = 'processing'
     and o.locked_at < pg_catalog.clock_timestamp() - interval '10 minutes'
     and o.attempts >= o.max_attempts;

  return query
  with candidates as (
    select o.id
      from public.integration_outbox o
     where (
       (o.status in ('pending','retry') and o.available_at <= pg_catalog.clock_timestamp())
       or
       (o.status = 'processing'
        and o.locked_at < pg_catalog.clock_timestamp() - interval '10 minutes'
        and o.attempts < o.max_attempts)
     )
     order by o.available_at, o.created_at
     for update skip locked
     limit p_limit
  )
  update public.integration_outbox o
     set status = 'processing',
         attempts = o.attempts + 1,
         locked_at = pg_catalog.clock_timestamp(),
         lock_token = pg_catalog.gen_random_uuid(),
         last_error = null
    from candidates c
   where o.id = c.id
  returning o.*;
end;
$$;

-- Completion is lease-token guarded: an expired/old worker cannot complete a
-- row that has already been reclaimed by another worker.
create or replace function public.complete_integration_outbox(
  p_id uuid, p_lock_token uuid
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  update public.integration_outbox
     set status = 'processed',
         processed_at = pg_catalog.clock_timestamp(),
         locked_at = null,
         lock_token = null,
         last_error = null
   where id = p_id and status = 'processing' and lock_token = p_lock_token;
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;

-- Retry uses capped exponential backoff plus small jitter; final failure is dead.
create or replace function public.fail_integration_outbox(
  p_id uuid, p_lock_token uuid, p_error text
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_status text;
declare v_attempts integer;
declare v_max integer;
declare v_delay integer;
begin
  select attempts, max_attempts
    into v_attempts, v_max
    from public.integration_outbox
   where id = p_id and status = 'processing' and lock_token = p_lock_token
   for update;

  if not found then return null; end if;

  if v_attempts >= v_max then
    v_status := 'dead';
  else
    v_status := 'retry';
  end if;

  v_delay := least(3600, 15 * (2 ^ greatest(v_attempts - 1, 0))::integer)
             + floor(pg_catalog.random() * 10)::integer;

  update public.integration_outbox
     set status = v_status,
         available_at = case when v_status = 'retry'
           then pg_catalog.clock_timestamp() + v_delay * interval '1 second'
           else available_at end,
         locked_at = null,
         lock_token = null,
         last_error = left(coalesce(p_error, 'UNKNOWN_ERROR'), 2000)
   where id = p_id and status = 'processing' and lock_token = p_lock_token;

  return v_status;
end;
$$;

revoke all on function public.claim_integration_outbox(integer) from public, anon, authenticated;
revoke all on function public.complete_integration_outbox(uuid, uuid) from public, anon, authenticated;
revoke all on function public.fail_integration_outbox(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_integration_outbox(integer) to service_role;
grant execute on function public.complete_integration_outbox(uuid, uuid) to service_role;
grant execute on function public.fail_integration_outbox(uuid, uuid, text) to service_role;

-- Consumer contract:
-- 1) external side effects receive idempotency key "<org_uuid>:<dedupe_key>".
-- 2) call complete only after downstream success.
-- 3) on failure call fail with the exact lock_token.
-- 4) external APIs without idempotency support are AT-LEAST-ONCE, not exactly-once.
-- 5) never delete webhook_events/outbox rows to simulate success.


-- Atomic ingress: the dedupe row and durable work item commit together.
-- webhook_events.dedupe_key is globally UNIQUE in the current database.
-- Dedupe keys are namespaced by immutable organization + provider so two
-- tenants may legitimately receive the same provider event identifier.
-- The source event and outbox row are inserted in this one transaction.
create or replace function public.enqueue_integration_event(
  p_organization_id uuid,
  p_provider text,
  p_event_type text,
  p_dedupe_key text,
  p_payload jsonb
) returns table(event_id uuid, duplicate boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_scoped_dedupe_key text;
begin
  if p_organization_id is null
     or length(coalesce(p_provider, '')) not between 1 and 120
     or length(coalesce(p_event_type, '')) not between 1 and 80
     or length(coalesce(p_dedupe_key, '')) not between 1 and 240
     or p_payload is null then
    raise exception 'INVALID_INTEGRATION_EVENT';
  end if;

  v_scoped_dedupe_key := p_organization_id::text || ':' || p_provider || ':' || p_dedupe_key;

  insert into public.webhook_events (
    organization_id, provider, event_type, dedupe_key, payload
  ) values (
    p_organization_id, p_provider, p_event_type, v_scoped_dedupe_key, p_payload
  )
  on conflict (dedupe_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select w.id into v_event_id
      from public.webhook_events w
     where w.dedupe_key = v_scoped_dedupe_key
       and w.organization_id = p_organization_id
       and w.provider = p_provider;
    if v_event_id is null then
      raise exception 'IDEMPOTENCY_KEY_COLLISION';
    end if;
    return query select v_event_id, true;
    return;
  end if;

  insert into public.integration_outbox (
    organization_id, dedupe_key, event_type, payload
  ) values (
    p_organization_id, v_scoped_dedupe_key, p_event_type, p_payload
  );

  return query select v_event_id, false;
end;
$$;

revoke all on function public.enqueue_integration_event(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.enqueue_integration_event(uuid, text, text, text, jsonb)
  to service_role;
