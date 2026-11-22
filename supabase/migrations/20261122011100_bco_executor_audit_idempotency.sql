-- Make executor audit events idempotent per originating automation run.
-- Staging-first migration. No production deployment is authorized by this file.
create or replace function public.record_bco_executor_audit(
  p_organization_id uuid,
  p_automation_id uuid,
  p_agent_id uuid,
  p_agent_slug text,
  p_task text,
  p_run_id uuid,
  p_status text,
  p_provider text default null,
  p_model text default null,
  p_error text default null,
  p_event_type text default 'automation_run_blocked',
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_ai_run_id uuid;
  v_created boolean := false;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if not exists (
    select 1 from public.automation_runs r
     where r.id = p_run_id
       and r.automation_id = p_automation_id
       and r.organization_id = p_organization_id
  ) then
    raise exception 'automation_run_scope_mismatch';
  end if;
  if not exists (
    select 1 from public.ai_agents a
     where a.id = p_agent_id
       and a.organization_id = p_organization_id
       and a.slug = p_agent_slug
  ) then
    raise exception 'agent_scope_mismatch';
  end if;

  insert into public.ai_runs (
    organization_id, agent, task, status, provider, model, input, output, error, started_at, completed_at
  ) values (
    p_organization_id, p_agent_slug, p_task, p_status, p_provider, p_model,
    jsonb_build_object('automation_run_id', p_run_id, 'automation_id', p_automation_id),
    '{}'::jsonb, left(p_error, 1000), now(), now()
  )
  on conflict (organization_id, (input->>'automation_run_id'))
    where input ? 'automation_run_id'
    do nothing
  returning id into v_ai_run_id;

  if v_ai_run_id is null then
    select id into v_ai_run_id
      from public.ai_runs
     where organization_id = p_organization_id
       and input->>'automation_run_id' = p_run_id::text
     limit 1;
  else
    v_created := true;
  end if;

  -- A duplicate audit call reuses the original ai_runs row and must not
  -- create another event for the same automation run.
  if v_created then
    insert into public.ai_agent_events (
      organization_id, agent_id, event_type, severity, entity_type, entity_id, payload
    ) values (
      p_organization_id, p_agent_id, p_event_type,
      case when p_status = 'completed' then 'info' else 'warning' end,
      'automation_run', p_run_id,
      coalesce(p_payload, '{}'::jsonb) || jsonb_build_object(
        'run_id', p_run_id, 'automation_id', p_automation_id, 'ai_run_id', v_ai_run_id
      )
    );
  end if;
  return v_ai_run_id;
end;
$function$;

revoke all on function public.record_bco_executor_audit(uuid, uuid, uuid, text, text, uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_bco_executor_audit(uuid, uuid, uuid, text, text, text, text, text, text, text, text, jsonb) to service_role;
