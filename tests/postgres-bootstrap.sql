\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE SCHEMA storage;

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL
);
CREATE TABLE public.memberships (
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  PRIMARY KEY (organization_id, user_id)
);
CREATE TABLE public.jobs (
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id)
);
CREATE TABLE public.job_assignments (
  organization_id uuid NOT NULL,
  job_id uuid NOT NULL,
  user_id uuid NOT NULL,
  PRIMARY KEY (organization_id, job_id, user_id)
);
CREATE TABLE public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  provider text NOT NULL,
  event_type text NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE FUNCTION private.is_org_member(org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.organization_id = org AND m.user_id = (SELECT auth.uid())
  )
$$;

CREATE FUNCTION private.org_role(org uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.role FROM public.memberships m
  WHERE m.organization_id = org AND m.user_id = (SELECT auth.uid())
  LIMIT 1
$$;

CREATE FUNCTION private.can_access_job(org uuid, job uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
  SELECT CASE
    WHEN private.org_role(org) IN ('owner','admin','manager') THEN true
    WHEN private.org_role(org) = 'worker' THEN EXISTS (
      SELECT 1 FROM public.job_assignments a
      WHERE a.organization_id = org
        AND a.job_id = job
        AND a.user_id = (SELECT auth.uid())
    )
    ELSE false
  END
$$;

CREATE FUNCTION storage.foldername(text) RETURNS text[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN cardinality(string_to_array($1, '/')) <= 1 THEN ARRAY[]::text[]
    ELSE (string_to_array($1, '/'))[1:cardinality(string_to_array($1, '/')) - 1]
  END
$$;

CREATE TABLE storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('bco-media','bco-media',false,NULL,NULL),
  ('job-media','job-media',false,15728640,ARRAY['image/jpeg','image/png','image/webp','application/pdf']);

CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text NOT NULL REFERENCES storage.buckets(id),
  name text NOT NULL,
  owner_id text,
  UNIQUE (bucket_id, name)
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA auth, private, storage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.org_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_job(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION storage.foldername(text) TO authenticated;

CREATE POLICY "bco media read org" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'bco-media'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND private.is_org_member(((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "bco media insert org" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'bco-media'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND private.is_org_member(((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "bco media update org" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'bco-media'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND private.is_org_member(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'bco-media'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND private.is_org_member(((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "bco media delete org" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'bco-media'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND private.is_org_member(((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "job_media_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'job-media'
  AND array_length(storage.foldername(name), 1) >= 2
  AND private.can_access_job(((storage.foldername(name))[1])::uuid, ((storage.foldername(name))[2])::uuid)
);
CREATE POLICY "job_media_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'job-media'
  AND array_length(storage.foldername(name), 1) >= 2
  AND private.can_access_job(((storage.foldername(name))[1])::uuid, ((storage.foldername(name))[2])::uuid)
);
CREATE POLICY "job_media_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'job-media'
  AND array_length(storage.foldername(name), 1) >= 2
  AND private.can_access_job(((storage.foldername(name))[1])::uuid, ((storage.foldername(name))[2])::uuid)
)
WITH CHECK (
  bucket_id = 'job-media'
  AND array_length(storage.foldername(name), 1) >= 2
  AND private.can_access_job(((storage.foldername(name))[1])::uuid, ((storage.foldername(name))[2])::uuid)
);
CREATE POLICY "job_media_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'job-media'
  AND array_length(storage.foldername(name), 1) >= 2
  AND private.org_role(((storage.foldername(name))[1])::uuid) = ANY (ARRAY['owner','admin','manager'])
);

INSERT INTO public.organizations(id,name) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Org A'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Org B');
INSERT INTO public.memberships(organization_id,user_id,role) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','worker'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','worker');
INSERT INTO public.jobs(id,organization_id) VALUES
('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('44444444-4444-4444-8444-444444444444','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO public.job_assignments(organization_id,job_id,user_id) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111');
