# BCO security review — 21 Nov 2026

Read-only review. No production policies, functions, or data were changed.

## Verified controls

- Supabase is ACTIVE_HEALTHY.
- RLS is enabled on all 42 public tables.
- Three server-only tables have no RLS policies and no direct SELECT grants to anon or authenticated; they are not exposed directly to browser roles.
- The reviewed public SECURITY DEFINER functions all have a fixed search_path. None is executable by anon. User-callable functions use auth.uid() and/or private.org_role(...); trigger-only and maintenance functions are not granted to user roles.
- bco-command-center currently has verify_jwt=true.

## Findings requiring follow-up

1. The deployed bco-command-center version still uses Access-Control-Allow-Origin: *, and its old organization resolver can select an arbitrary first membership. A replacement source file is prepared on bco/control-plane-v1; it is not deployed.
2. set_my_organization_slug(new_slug) selects the first eligible owner/admin organization for the user. In a multi-organization account it can update the wrong organization. Replace with an explicit-organization RPC and keep the old function safe for ambiguous users.
3. tasks_update allows an assigned user through assigned_to = auth.uid() in both USING and WITH CHECK. The WITH CHECK does not independently require membership in the target organization; review a narrow policy/trigger correction before production.
4. bco_integrations SELECT is available to every organization member. Current credential_ref is null, but keep actual secrets out of config; use secret storage and non-sensitive references only.
5. The BCO Worker preview currently has no Supabase bindings/secrets or scheduled handler. The scheduler migration and Worker source are preparation only.

## Do not deploy yet

Before any production change: take and verify a database backup, apply the migration to staging, test membership/RLS/CORS and scheduler retries, run the full CI suite, verify a rollback, then request approval for the production change.
