-- Additive, non-destructive scheduler foundation.
-- Do not apply to production until a database backup, staging test and rollback are verified.
alter table public.automations
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_retry_at timestamptz,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists last_error text;

alter table public.automation_runs
  add column if not exists schedule_slot timestamptz,
  add column if not exists idempotency_key text,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists attempt_count integer not null default 0;

create unique index if not exists automation_runs_idempotency_key_uidx
  on public.automation_runs (idempotency_key)
  where idempotency_key is not null;

create index if not exists automations_due_scheduler_idx
  on public.automations (active, trigger_type, next_retry_at, lease_expires_at, last_run_at);

create or replace function public.claim_bco_automation_runs(p_slot timestamptz, p_limit integer default 20)
returns table (
  run_id uuid,
  automation_id uuid,
  organization_id uuid,
  action_config jsonb,
  trigger_config jsonb,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  update public.automation_runs
     set status = 'failed',
         error = coalesce(error, 'LEASE_EXPIRED'),
         completed_at = coalesce(completed_at, now()),
         lease_expires_at = null
   where status = 'running'
     and lease_expires_at is not null
     and lease_expires_at <= now();

  return query
  with due as (
    select a.id
      from public.automations a
     where a.active = true
       and a.trigger_type = 'scheduled'
       and (a.lease_expires_at is null or a.lease_expires_at <= now())
       and (a.next_retry_at is null or a.next_retry_at <= now())
       and (
         a.last_run_at is null
         or a.last_run_at <= now() - make_interval(mins =>
           case
             when coalesce(a.trigger_config->>'interval_minutes', '') ~ '^[0-9]+$'
               then greatest((a.trigger_config->>'interval_minutes')::integer, 1)
             when coalesce(a.trigger_config->>'interval_hours', '') ~ '^[0-9]+$'
               then greatest((a.trigger_config->>'interval_hours')::integer, 1) * 60
             when a.trigger_config->>'schedule' = 'every_6_hours' then 360
             when a.trigger_config->>'schedule' = 'every_5_minutes' then 5
             else 60
           end
         )
       )
     order by a.last_attempt_at nulls first, a.created_at
     for update skip locked
     limit greatest(1, least(coalesce(p_limit, 20), 50))
  ),
  claimed as (
    update public.automations a
       set last_attempt_at = now(),
           lease_expires_at = now() + interval '5 minutes',
           attempt_count = a.attempt_count + 1,
           last_error = null
      from due d
     where a.id = d.id
    returning a.id, a.organization_id, a.action_config, a.trigger_config, a.attempt_count
  ),
  inserted as (
    insert into public.automation_runs (
      organization_id, automation_id, status, input, started_at,
      schedule_slot, idempotency_key, lease_expires_at, attempt_count
    )
    select c.organization_id, c.id, 'running',
           jsonb_build_object('schedule_slot', p_slot),
           now(), p_slot,
           c.id::text || ':' || to_char(date_trunc('minute', p_slot at time zone 'UTC'), 'YYYYMMDDHH24MI'),
           now() + interval '5 minutes',
           c.attempt_count
      from claimed c
    on conflict (idempotency_key) where idempotency_key is not null do nothing
    returning id, automation_id, organization_id, attempt_count
  )
  select i.id, i.automation_id, i.organization_id, c.action_config, c.trigger_config, i.attempt_count
    from inserted i
    join claimed c on c.id = i.automation_id;
end;
$function$;

revoke all on function public.claim_bco_automation_runs(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.claim_bco_automation_runs(timestamptz, integer) to service_role;


create or replace function public.finish_bco_automation_run(
  p_run_id uuid,
  p_automation_id uuid,
  p_success boolean,
  p_output jsonb default null,
  p_error text default null,
  p_retry_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  update public.automation_runs
     set status = case when p_success then 'completed' else 'failed' end,
         output = case when p_success then p_output else output end,
         error = case when p_success then null else left(coalesce(p_error, 'EXECUTION_FAILED'), 1000) end,
         completed_at = now(),
         lease_expires_at = null
   where id = p_run_id
     and automation_id = p_automation_id
     and status = 'running';

  if not found then
    raise exception 'automation_run_not_found_or_not_running';
  end if;

  update public.automations
     set last_run_at = case when p_success then now() else last_run_at end,
         lease_expires_at = null,
         next_retry_at = case when p_success then null else p_retry_at end,
         attempt_count = case when p_success then 0 else attempt_count end,
         last_error = case when p_success then null else left(coalesce(p_error, 'EXECUTION_FAILED'), 1000) end
   where id = p_automation_id;

  if not found then
    raise exception 'automation_not_found';
  end if;
end;
$function$;

revoke all on function public.finish_bco_automation_run(uuid, uuid, boolean, jsonb, text, timestamptz) from public, anon, authenticated;
grant execute on function public.finish_bco_automation_run(uuid, uuid, boolean, jsonb, text, timestamptz) to service_role;
