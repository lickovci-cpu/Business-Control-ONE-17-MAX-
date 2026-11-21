# BCO identity + private Storage: verified design

Status: DESIGN VERIFIED AGAINST CURRENT APP + READ-ONLY SUPABASE METADATA.
No production code, bucket, RLS policy, or database object was changed.

## Existing identity is already present
- `public/app.js` already signs users in through Supabase Auth and stores `access_token` / `refresh_token` in its existing cloud session.
- `cloudIdentity()` calls `/auth/v1/user`, then reads `public.memberships` with the user's Bearer token and resolves the selected organization.
- The browser's API helper forwards the current Supabase access token as Authorization: Bearer.
- `bc_session` is a separate password-panel session. Its signed payload contains only expiry + nonce; it is NOT a user identity and MUST NOT authorize organization-scoped Storage.
- Current server `auth(req)` validates only `bc_session` or server-to-server `x-app-key`. Do not silently treat either as Supabase identity.

## Verified current Supabase state (read-only)
- `memberships` has `organization_id`, `user_id`, `role`; its RLS SELECT policy limits rows to the user's own memberships or owner/admin access.
- `private.is_org_member(uuid)` checks `memberships.user_id = auth.uid()`.
- `private.org_role(uuid)` resolves the current user's role for an organization.
- `private.can_access_job(org, job)` grants owner/admin/manager access and limits worker access to assigned jobs.
- `storage.buckets`: `bco-media` is private; `job-media` is private.
- Existing `storage.objects` policies already scope `bco-media` to first folder = organization UUID and `private.is_org_member(org)`.
- Existing `job-media` policies require org UUID + job UUID folders and `private.can_access_job(org, job)`.
- `job-media` has 15 MiB limit and JPEG/PNG/WebP/PDF MIME allowlist. `bco-media` currently has no bucket-level size/MIME restriction.

## Required upload authorization flow
1. Require a valid Supabase Auth access token. Verify it server-side using Supabase Auth `GET /auth/v1/user` (do not decode JWT and trust unverified claims).
2. Derive immutable `user.id` from the Auth response. Never accept a user ID as authority from request JSON.
3. Resolve the requested organization by querying `memberships` with the same user's JWT (RLS on); do not use `bc_session` or a client-supplied org ID alone.
4. For `bco-media`, object path must be `<verified-org-uuid>/<server-generated-object-id>.<validated-extension>`.
5. For `job-media`, path must be `<verified-org-uuid>/<verified-job-uuid>/<server-generated-object-id>.<extension>`; the existing RLS policy must verify assignment/role.
6. Prefer forwarding the user's JWT to Storage so existing RLS remains the final authorization boundary. Do not use service-role Storage calls as an authorization shortcut.
7. Enforce 4 MiB upload limit and allowlist (JPEG/PNG/WebP/GIF, MP4/WebM/QuickTime, PDF) before forwarding. The current `bco-media` bucket has no server-enforced cap; do not enable uploads until a bucket-level cap/MIME allowlist is reviewed and applied in an approved migration, or until the Worker strictly streams and enforces the same cap.
8. Generate object names server-side; reject path traversal, arbitrary bucket names, upsert/overwrite by default, and caller-supplied public URLs.
9. For downloads, use authenticated Storage requests or short-lived signed URLs only after membership verification. Keep buckets private.

## Implementation decision
- Reuse Supabase Auth already in the app; do not create another login system or table.
- Use the current `sbSession.access_token` only as a bearer token, with refresh via existing `sbRefresh()`.
- Add a dedicated Cloudflare Worker upload endpoint that validates Auth user, membership, size and MIME, then calls Storage with the user's JWT. Never place service-role/secret keys in browser code.
- Keep `bc_session` for the legacy app panel only until a separate migration removes it.
- Cross-org tests must prove user A cannot upload/read/delete in org B; worker cannot access unassigned job in `job-media`.

## Go-live gate
BLOCKED until: bucket-level restrictions for `bco-media` are approved; upload endpoint has integration tests for missing/expired/forged JWT, non-member org, worker job assignment, size/MIME/path traversal, overwrite, and private download; and a rollback is rehearsed. No schema or policy change is authorized by this design document.
