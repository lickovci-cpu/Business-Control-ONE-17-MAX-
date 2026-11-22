-- BCO Revenue Engine: safe proposal rejection and authenticated staging workspace bootstrap.
-- The bootstrap creates only an internal CEO planner. No external actions are enabled.

create or replace function private.reject_internal_task_proposal(p_proposal_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_proposal public.internal_task_proposals%rowtype;
  v_role text;
  v_agent_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  select * into v_proposal
  from public.internal_task_proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'PROPOSAL_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_role := private.org_role(v_proposal.organization_id);
  if coalesce(v_role, '') not in ('owner','admin','manager') then
    raise exception 'PROPOSAL_REJECTION_FORBIDDEN' using errcode = '42501';
  end if;

  if v_proposal.status = 'rejected' then
    return true;
  end if;

  if v_proposal.status <> 'proposed' then
    raise exception 'PROPOSAL_NOT_REJECTABLE' using errcode = '55000';
  end if;

  update public.internal_task_proposals
  set status = 'rejected', updated_at = now()
  where id = v_proposal.id;

  select id into v_agent_id
  from public.ai_agents
  where organization_id = v_proposal.organization_id and slug = 'ceo'
  limit 1;

  insert into public.ai_agent_events (
    organization_id, agent_id, event_type, severity, entity_type, entity_id, payload
  ) values (
    v_proposal.organization_id, v_agent_id, 'task_proposal_rejected', 'info',
    'internal_task_proposal', v_proposal.id,
    jsonb_build_object(
      'project_id', v_proposal.project_id,
      'rejected_by', v_user_id,
      'idempotency_key', v_proposal.idempotency_key
    )
  );

  return true;
end;
$function$;

revoke all on function private.reject_internal_task_proposal(uuid) from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function private.reject_internal_task_proposal(uuid) to authenticated, service_role;

create or replace function public.reject_internal_task_proposal(p_proposal_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.reject_internal_task_proposal(p_proposal_id);
$function$;

revoke all on function public.reject_internal_task_proposal(uuid) from public, anon;
grant execute on function public.reject_internal_task_proposal(uuid) to authenticated, service_role;


create or replace function private.create_bco_revenue_workspace(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text := 'bco-' || replace(gen_random_uuid()::text, '-', '');
  v_agent_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  if length(v_name) < 2 or length(v_name) > 100 then
    raise exception 'WORKSPACE_NAME_INVALID' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.memberships where user_id = v_user_id
  ) then
    raise exception 'WORKSPACE_ALREADY_EXISTS' using errcode = '23505';
  end if;

  insert into public.organizations (name, slug)
  values (v_name, v_slug)
  returning id into v_org_id;

  insert into public.memberships (organization_id, user_id, role)
  values (v_org_id, v_user_id, 'owner');

  insert into public.ai_agents (
    organization_id, slug, name, description, active,
    autonomy_level, allowed_actions, config
  ) values (
    v_org_id, 'ceo', 'BCO Revenue Planner',
    'Deterministic internal planner. External actions are disabled.',
    true, 'autonomous', '["prioritize","recommend"]'::jsonb,
    '{"mode":"autonomous-planner"}'::jsonb
  )
  returning id into v_agent_id;

  insert into public.automations (
    organization_id, name, active, trigger_type, trigger_config, action_config
  ) values (
    v_org_id, 'BCO daily internal revenue planning', true, 'scheduled',
    '{"interval_hours":24}'::jsonb,
    '{"agent":"ceo","action":"autonomous_tick","operations":[]}'::jsonb
  );

  return v_org_id;
end;
$function$;

revoke all on function private.create_bco_revenue_workspace(text) from public, anon;
grant execute on function private.create_bco_revenue_workspace(text) to authenticated;

create or replace function public.create_bco_revenue_workspace(p_name text)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.create_bco_revenue_workspace(p_name);
$function$;

revoke all on function public.create_bco_revenue_workspace(text) from public, anon;
grant execute on function public.create_bco_revenue_workspace(text) to authenticated;
