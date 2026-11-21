-- Isolated local Supabase fixture. Never applied to the hosted project.
create schema if not exists private;

create table public.organizations (
  id uuid primary key,
  name text not null
);
create table public.memberships (
  organization_id uuid not null,
  user_id uuid not null,
  role text not null,
  primary key (organization_id, user_id)
);
create table public.jobs (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id)
);
create table public.job_assignments (
  organization_id uuid not null,
  job_id uuid not null,
  user_id uuid not null,
  primary key (organization_id, job_id, user_id)
);
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  provider text not null,
  event_type text not null,
  dedupe_key text not null unique,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.jobs enable row level security;
alter table public.job_assignments enable row level security;
alter table public.webhook_events enable row level security;
revoke all on public.organizations, public.memberships, public.jobs,
  public.job_assignments, public.webhook_events from anon, authenticated;
grant all on public.organizations, public.memberships, public.jobs,
  public.job_assignments, public.webhook_events to service_role;

create or replace function private.is_org_member(org uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org and m.user_id = (select auth.uid())
  )
$$;

create or replace function private.org_role(org uuid)
returns text language sql stable security definer
set search_path = public, pg_temp
as $$
  select m.role from public.memberships m
  where m.organization_id = org and m.user_id = (select auth.uid())
  limit 1
$$;

create or replace function private.can_access_job(org uuid, job uuid)
returns boolean language sql stable security definer
set search_path = public, private, pg_temp
as $$
  select case
    when private.org_role(org) in ('owner','admin','manager') then true
    when private.org_role(org) = 'worker' then exists (
      select 1 from public.job_assignments a
      where a.organization_id = org
        and a.job_id = job
        and a.user_id = (select auth.uid())
    )
    else false
  end
$$;

revoke all on function private.is_org_member(uuid) from public, anon;
revoke all on function private.org_role(uuid) from public, anon;
revoke all on function private.can_access_job(uuid, uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_org_member(uuid) to authenticated;
grant execute on function private.org_role(uuid) to authenticated;
grant execute on function private.can_access_job(uuid, uuid) to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values
  ('bco-media','bco-media',false,4194304,
   array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime','application/pdf']),
  ('job-media','job-media',false,15728640,
   array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create policy "bco media read org" on storage.objects
for select to authenticated
using (
  bucket_id = 'bco-media'
  and (storage.foldername(name))[1] is not null
  and private.is_org_member(((storage.foldername(name))[1])::uuid)
);
create policy "bco media insert org" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'bco-media'
  and (storage.foldername(name))[1] is not null
  and private.is_org_member(((storage.foldername(name))[1])::uuid)
);
create policy "bco media update org" on storage.objects
for update to authenticated
using (
  bucket_id = 'bco-media'
  and (storage.foldername(name))[1] is not null
  and private.is_org_member(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'bco-media'
  and (storage.foldername(name))[1] is not null
  and private.is_org_member(((storage.foldername(name))[1])::uuid)
);
create policy "bco media delete org" on storage.objects
for delete to authenticated
using (
  bucket_id = 'bco-media'
  and (storage.foldername(name))[1] is not null
  and private.is_org_member(((storage.foldername(name))[1])::uuid)
);
create policy "job_media_select" on storage.objects
for select to authenticated
using (
  bucket_id = 'job-media'
  and array_length(storage.foldername(name),1) >= 2
  and private.can_access_job(((storage.foldername(name))[1])::uuid,((storage.foldername(name))[2])::uuid)
);
create policy "job_media_insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'job-media'
  and array_length(storage.foldername(name),1) >= 2
  and private.can_access_job(((storage.foldername(name))[1])::uuid,((storage.foldername(name))[2])::uuid)
);
create policy "job_media_update" on storage.objects
for update to authenticated
using (
  bucket_id = 'job-media'
  and array_length(storage.foldername(name),1) >= 2
  and private.can_access_job(((storage.foldername(name))[1])::uuid,((storage.foldername(name))[2])::uuid)
)
with check (
  bucket_id = 'job-media'
  and array_length(storage.foldername(name),1) >= 2
  and private.can_access_job(((storage.foldername(name))[1])::uuid,((storage.foldername(name))[2])::uuid)
);
create policy "job_media_delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'job-media'
  and array_length(storage.foldername(name),1) >= 2
  and private.org_role(((storage.foldername(name))[1])::uuid) = any(array['owner','admin','manager'])
);
