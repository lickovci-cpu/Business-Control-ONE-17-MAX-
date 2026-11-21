-- PREVIEW PROPOSAL ONLY. Not executed against Supabase.
-- Current webhook_events.dedupe_key already has a UNIQUE constraint.
-- Handler must switch from SELECT-then-INSERT to INSERT ... ON CONFLICT
-- and treat the conflict as duplicate; do not delete an accepted event row
-- after partial downstream effects. Move side effects to retryable outbox.

create table public.integration_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  dedupe_key text not null check (length(dedupe_key) between 1 and 240),
  event_type text not null check (length(event_type) between 1 and 80),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','processed','retry','dead')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  lock_token uuid,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (organization_id, dedupe_key),
  check ((status = 'processing') = (locked_at is not null and lock_token is not null))
);
create index integration_outbox_ready_idx on public.integration_outbox (available_at, created_at) where status in ('pending','retry');
create index integration_outbox_lease_idx on public.integration_outbox (locked_at) where status = 'processing';
alter table public.integration_outbox enable row level security;
revoke all on public.integration_outbox from anon, authenticated;
grant select, insert, update, delete on public.integration_outbox to service_role;

create or replace function public.claim_integration_outbox(p_limit integer default 20)
returns setof public.integration_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then raise exception 'INVALID_BATCH_SIZE'; end if;
  return query
  with candidates as (
    select o.id from public.integration_outbox o
    where ((o.status in ('pending','retry') and o.available_at <= pg_catalog.now())
       or (o.status = 'processing' and o.locked_at < pg_catalog.now() - interval '10 minutes'))
    order by o.available_at, o.created_at
    for update skip locked
    limit p_limit
  )
  update public.integration_outbox o
     set status='processing', attempts=o.attempts+1,
         locked_at=pg_catalog.now(), lock_token=pg_catalog.gen_random_uuid()
    from candidates c where o.id=c.id
  returning o.*;
end;
$$;
revoke all on function public.claim_integration_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_integration_outbox(integer) to service_role;

