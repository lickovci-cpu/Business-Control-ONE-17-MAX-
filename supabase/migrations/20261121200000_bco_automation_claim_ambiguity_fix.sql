-- Staging-safe function replacement for ambiguous PL/pgSQL output-column names.
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
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_slot is null then
    raise exception 'schedule_slot_required';
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
       and not exists (
         select 1
           from public.automation_runs existing_run
          where existing_run.idempotency_key =
            a.id::text || ':' || to_char(date_trunc('minute', p_slot at time zone 'UTC'), 'YYYYMMDDHH24MI')
       )
       and (
         (a.next_retry_at is not null and a.next_retry_at <= now())
         or
         (a.next_retry_at is null and (
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
         ))
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
    insert into public.automation_runs as ar (
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
    returning ar.id, ar.automation_id, ar.organization_id, ar.attempt_count
  )
  select i.id, i.automation_id, i.organization_id, c.action_config, c.trigger_config, i.attempt_count
    from inserted i
    join claimed c on c.id = i.automation_id;
end;
$function$;

revoke all on function public.claim_bco_automation_runs(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.claim_bco_automation_runs(timestamptz, integer) to service_role;
