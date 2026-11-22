-- Record approve/reject state transitions in the tenant-scoped audit log.
-- A status transition emits exactly one audit row; repeated idempotent RPC calls
-- return before UPDATE and therefore do not create duplicate audit entries.

create or replace function public.audit_internal_task_proposal_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if old.status is distinct from new.status
     and new.status in ('approved', 'rejected') then
    insert into public.audit_log
      (organization_id, actor_user_id, action, entity_type, entity_id, metadata)
    values
      (
        new.organization_id,
        auth.uid(),
        'internal_task_proposals.' || new.status,
        'internal_task_proposals',
        new.id::text,
        pg_catalog.jsonb_build_object(
          'status', new.status,
          'project_id', new.project_id,
          'idempotency_key', new.idempotency_key,
          'approved_task_id', new.approved_task_id
        )
      );
  end if;
  return new;
end;
$fn$;

revoke all on function public.audit_internal_task_proposal_status()
  from public, anon, authenticated;

create trigger internal_task_proposals_audit_status
after update of status on public.internal_task_proposals
for each row
when (old.status is distinct from new.status)
execute function public.audit_internal_task_proposal_status();
