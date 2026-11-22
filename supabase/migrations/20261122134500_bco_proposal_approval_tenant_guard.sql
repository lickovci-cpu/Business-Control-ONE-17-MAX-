-- Fail closed on missing tenant membership: SQL NULL must never authorize.
create or replace function private.approve_internal_task_proposal(p_proposal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_proposal public.internal_task_proposals%rowtype;
  v_task_id uuid;
  v_agent_id uuid;
  v_role text;
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
    raise exception 'PROPOSAL_APPROVAL_FORBIDDEN' using errcode = '42501';
  end if;

  if v_proposal.status = 'approved' then
    return v_proposal.approved_task_id;
  end if;

  if v_proposal.status <> 'proposed' then
    raise exception 'PROPOSAL_NOT_APPROVABLE' using errcode = '55000';
  end if;

  insert into public.tasks (
    organization_id, title, status, priority, due_at,
    entity_type, entity_id, notes
  ) values (
    v_proposal.organization_id,
    v_proposal.title,
    'open',
    v_proposal.priority,
    v_proposal.due_at,
    case when v_proposal.source_type in ('lead','opportunity') then v_proposal.source_type else null end,
    v_proposal.source_id,
    concat_ws(E'\n', nullif(v_proposal.task_notes,''), 'Projekt: ' || v_proposal.project_id,
      'Návrh: ' || v_proposal.id::text, 'Důvod: ' || v_proposal.rationale)
  ) returning id into v_task_id;

  update public.internal_task_proposals
  set status = 'approved', approved_task_id = v_task_id,
      approved_by = v_user_id, approved_at = now(), updated_at = now()
  where id = v_proposal.id;

  select id into v_agent_id from public.ai_agents
  where organization_id = v_proposal.organization_id and slug = 'ceo' limit 1;

  insert into public.ai_agent_events (
    organization_id, agent_id, event_type, severity, entity_type, entity_id, payload
  ) values (
    v_proposal.organization_id, v_agent_id, 'task_proposal_approved', 'info',
    'internal_task_proposal', v_proposal.id,
    jsonb_build_object('task_id', v_task_id, 'project_id', v_proposal.project_id,
      'approved_by', v_user_id, 'idempotency_key', v_proposal.idempotency_key)
  );

  return v_task_id;
end;
$function$;

revoke all on function private.approve_internal_task_proposal(uuid) from public, anon;
grant execute on function private.approve_internal_task_proposal(uuid) to authenticated, service_role;
