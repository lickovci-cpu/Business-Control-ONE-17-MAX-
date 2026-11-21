-- PREPARED SECURITY PATCH — NOT APPLIED.
-- Apply only after verified backup, staging test and rollback approval.
begin;

-- Close the assigned_to=auth.uid() path for users who are no longer
-- members of the task's organization.
drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
for update to authenticated
using (
  private.is_org_member(organization_id)
  and (
    private.org_role(organization_id) in ('owner','admin','manager')
    or assigned_to = (select auth.uid())
  )
)
with check (
  private.is_org_member(organization_id)
  and (
    private.org_role(organization_id) in ('owner','admin','manager')
    or assigned_to = (select auth.uid())
  )
);

-- Add an explicit-organization RPC. It never guesses which organization
-- the caller intended to change.
create or replace function public.set_organization_slug(
  target_org_id uuid,
  new_slug text
)
returns public.organizations
language plpgsql
security definer
set search_path = public, private, pg_temp
as $function$
declare
  uid uuid := (select auth.uid());
  clean text := nullif(lower(regexp_replace(coalesce(new_slug,''),'[^a-zA-Z0-9-]+','-','g')),'');
  result public.organizations;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  if coalesce(private.org_role(target_org_id),'') not in ('owner','admin') then
    raise exception 'not_allowed';
  end if;
  if clean is null or length(clean)<3 or length(clean)>80 then
    raise exception 'invalid_slug';
  end if;
  update public.organizations set slug=clean
   where id=target_org_id returning * into result;
  if result.id is null then raise exception 'organization_not_found'; end if;
  insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(target_org_id,uid,'organization.slug_updated','organization',target_org_id::text,jsonb_build_object('slug',clean));
  return result;
end
$function$;

revoke all on function public.set_organization_slug(uuid,text) from public, anon;
grant execute on function public.set_organization_slug(uuid,text) to authenticated;

-- Keep the legacy RPC safe: it only works if exactly one owner/admin
-- organization exists. Multi-organization callers must use the explicit RPC.
create or replace function public.set_my_organization_slug(new_slug text)
returns public.organizations
language plpgsql
security definer
set search_path = public, private, pg_temp
as $function$
declare
  uid uuid := (select auth.uid());
  org_count integer;
  org uuid;
  result public.organizations;
  clean text := nullif(lower(regexp_replace(coalesce(new_slug,''),'[^a-zA-Z0-9-]+','-','g')),'');
begin
  if uid is null then raise exception 'authentication_required'; end if;
  select count(*)::integer, min(organization_id)
    into org_count, org
    from public.memberships
   where user_id=uid and role in ('owner','admin');
  if org_count=0 then raise exception 'organization_not_found'; end if;
  if org_count>1 then raise exception 'organization_selection_required'; end if;
  if clean is null or length(clean)<3 or length(clean)>80 then raise exception 'invalid_slug'; end if;
  update public.organizations set slug=clean where id=org returning * into result;
  if result.id is null then raise exception 'organization_not_found'; end if;
  insert into public.audit_log(organization_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(org,uid,'organization.slug_updated','organization',org::text,jsonb_build_object('slug',clean));
  return result;
end
$function$;

-- This file is a preparation artifact. Remove this final ROLLBACK only
-- when intentionally applying the reviewed patch in a controlled release.
rollback;
