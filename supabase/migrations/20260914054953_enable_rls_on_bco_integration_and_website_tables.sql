alter table public.bco_integrations enable row level security;
alter table public.bco_websites enable row level security;

drop policy if exists bco_integrations_select on public.bco_integrations;
drop policy if exists bco_integrations_insert on public.bco_integrations;
drop policy if exists bco_integrations_update on public.bco_integrations;
drop policy if exists bco_integrations_delete on public.bco_integrations;

create policy bco_integrations_select on public.bco_integrations
  for select to authenticated
  using (private.is_org_member(organization_id));
create policy bco_integrations_insert on public.bco_integrations
  for insert to authenticated
  with check (private.org_role(organization_id) = any (array['owner'::text,'admin'::text]));
create policy bco_integrations_update on public.bco_integrations
  for update to authenticated
  using (private.org_role(organization_id) = any (array['owner'::text,'admin'::text]))
  with check (private.org_role(organization_id) = any (array['owner'::text,'admin'::text]));
create policy bco_integrations_delete on public.bco_integrations
  for delete to authenticated
  using (private.org_role(organization_id) = any (array['owner'::text,'admin'::text]));

drop policy if exists bco_websites_select on public.bco_websites;
drop policy if exists bco_websites_insert on public.bco_websites;
drop policy if exists bco_websites_update on public.bco_websites;
drop policy if exists bco_websites_delete on public.bco_websites;

create policy bco_websites_select on public.bco_websites
  for select to authenticated
  using (private.is_org_member(organization_id));
create policy bco_websites_insert on public.bco_websites
  for insert to authenticated
  with check (private.org_role(organization_id) = any (array['owner'::text,'admin'::text]));
create policy bco_websites_update on public.bco_websites
  for update to authenticated
  using (private.org_role(organization_id) = any (array['owner'::text,'admin'::text]))
  with check (private.org_role(organization_id) = any (array['owner'::text,'admin'::text]));
create policy bco_websites_delete on public.bco_websites
  for delete to authenticated
  using (private.org_role(organization_id) = any (array['owner'::text,'admin'::text]));
