-- BCO Internal Revenue Engine V1: durable, tenant-scoped task proposals.
-- Staging-first migration. Proposals are not tasks until an authorized approval.

create table if not exists public.internal_task_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id text not null check (project_id in ('nrsm', 'mazliprint', 'local-proof-factory', 'unassigned')),
  source_type text not null check (source_type in ('lead', 'opportunity', 'project')),
  source_id uuid,
  idempotency_key text not null,
  title text not null check (length(btrim(title)) between 3 and 240),
  rationale text not null check (length(btrim(rationale)) between 3 and 4000),
  score numeric(8,2) not null default 0 check (score >= 0 and score <= 1000),
  priority text not null default 'B' check (priority in ('A','B','C')),
  due_at timestamptz,
  task_notes text not null default '',
  status text not null default 'proposed' check (status in ('proposed','approved','rejected')),
  approved_task_id uuid unique references public.tasks(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  check (
    (status = 'approved' and approved_task_id is not null and approved_at is not null)
    or (status <> 'approved' and approved_task_id is null and approved_at is null)
  )
);

create index if not exists internal_task_proposals_org_status_score_idx
  on public.internal_task_proposals (organization_id, status, score desc, created_at desc);
create index if not exists internal_task_proposals_source_idx
  on public.internal_task_proposals (organization_id, source_type, source_id);

alter table public.internal_task_proposals enable row level security;

drop policy if exists internal_task_proposals_select on public.internal_task_proposals;
create policy internal_task_proposals_select
  on public.internal_task_proposals for select to authenticated
  using (private.org_role(organization_id) is not null);

drop policy if exists internal_task_proposals_service_insert on public.internal_task_proposals;
create policy internal_task_proposals_service_insert
  on public.internal_task_proposals for insert to service_role
  with check (true);

grant select on public.internal_task_proposals to authenticated;
grant select, insert, update, delete on public.internal_task_proposals to service_role;

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

  if private.org_role(v_proposal.organization_id) not in ('owner','admin','manager') then
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
  set status = 'approved',
      approved_task_id = v_task_id,
      approved_by = v_user_id,
      approved_at = now(),
      updated_at = now()
  where id = v_proposal.id;

  select id into v_agent_id
  from public.ai_agents
  where organization_id = v_proposal.organization_id and slug = 'ceo'
  limit 1;

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
grant usage on schema private to authenticated, service_role;
grant execute on function private.approve_internal_task_proposal(uuid) to authenticated, service_role;

create or replace function public.approve_internal_task_proposal(p_proposal_id uuid)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.approve_internal_task_proposal(p_proposal_id);
$function$;

revoke all on function public.approve_internal_task_proposal(uuid) from public, anon;
grant execute on function public.approve_internal_task_proposal(uuid) to authenticated, service_role;
