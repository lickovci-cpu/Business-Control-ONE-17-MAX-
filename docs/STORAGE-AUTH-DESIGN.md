# BCO identity + private Storage

Status: PARTIAL IMPLEMENTATION IN ISOLATED BRANCH; UNIT TESTED. NOT DEPLOYED.

No production code, bucket, RLS policy, database object, domain, or DNS was changed.

## Existing identity
- The mobile app already signs in through Supabase Auth in `public/app.js`.
- `cloudIdentity()` verifies the user with `GET /auth/v1/user`, then reads `public.memberships` using that user's Bearer token and resolves the selected organization.
- The API helper forwards the current Supabase access token as `Authorization: Bearer`.
- `sbSession` currently persists both access and refresh tokens in browser `localStorage`. This is a remaining XSS/session-theft risk; a future HttpOnly refresh-cookie/BFF migration should be evaluated before broad public access.
- `bc_session` is a separate password-panel session. Its signed payload contains only expiry + nonce; it is NOT a user identity and MUST NOT authorize organization-scoped Storage.
- Legacy `auth(req)` validates only `bc_session` or server-to-server `x-app-key`; the new Storage route does not call it.

## Verified current Supabase state (read-only)
- `memberships` has `organization_id`, `user_id`, `role`; its RLS SELECT policy limits rows to the user's own memberships or owner/admin access.
- `private.is_org_member(uuid)` checks `memberships.user_id = auth.uid()`.
- `private.org_role(uuid)` resolves the current user's role for an organization.
- `private.can_access_job(org, job)` grants owner/admin/manager access and limits worker access to assigned jobs.
- `bco-media` and `job-media` are private buckets.
- Existing `bco-media` object policies scope the first path folder to organization UUID and `private.is_org_member(org)`.
- Existing `job-media` policies require org UUID + job UUID folders and `private.can_access_job(org, job)`.
- `job-media` has a 15 MiB limit and JPEG/PNG/WebP/PDF MIME allowlist.
- `bco-media` currently has no bucket-level size/MIME restriction. The route-level 4 MiB check is not sufficient by itself because a client holding a valid JWT can call Storage directly.

## Implemented in the isolated branch
- `api/_cloud-identity-core.js`: runtime-neutral Supabase JWT + organization membership verifier shared by Vercel and Cloudflare.
- `api/_cloud-auth.js`: `cloudIdentityForOrganization()` wraps the shared verifier and never falls back to `bc_session`.
- `api/cloud-storage.js`: dedicated Vercel/Node upload/download adapter.
- `workers/bco-private-storage.js`: Cloudflare Workers Fetch API adapter using the same identity verifier and identical upload/download rules. It does not use `bc_session` or service-role credentials for Storage access.
- Upload: allowlisted buckets only; organization/job IDs validated; object names generated server-side; user JWT forwarded to Storage; no upsert; 4 MiB cap; MIME allowlist plus basic file-signature validation.
- Download: organization-scoped path validation; signed URL requested with the user's JWT; expiry fixed at 120 seconds; buckets remain private.
- `BCO_PRIVATE_STORAGE_ENABLED` defaults to disabled. The route returns 503 until explicitly enabled by server configuration.
- `tests/cloud-storage-api.mjs` and `tests/cloudflare-private-storage.test.mjs` cover missing/forged JWT, non-member organization, user-JWT forwarding, job-media RLS denial, size/MIME/signature checks, path traversal, cross-org paths, no-upsert, and 120-second signed downloads.
- `tests/cloud-storage-local-api.mjs` is wired into `tests/supabase-storage-auth.sh`; GitHub CI will exercise both adapters against real JWTs from an isolated local Supabase stack, including assigned/unassigned job access and a real signed download.

## Cloudflare / go-live boundary
- The Cloudflare Worker adapter now exists in the isolated branch, but it is NOT yet wired into the static preview Worker.
- The Cloudflare preview Worker continues to return 503 for API routes (`backend=not-connected`). This is intentional; no production Supabase key is connected to preview.
- Local Docker/Supabase CLI are not installed on the connected Windows laptop, so the full local Auth + RLS integration run is deferred to the existing GitHub Actions job.
- Before enabling uploads, review and apply `docs/bco-media-bucket-hardening-proposal.sql` through a separately approved migration so direct Storage calls cannot bypass bucket size/MIME limits.
- Do not expose service-role keys to the browser.

## Go-live gate
BLOCKED until: bucket-level `bco-media` restrictions are approved and tested; Worker adapter is wired into a dedicated preview API path; expired/forged JWT and cross-org/job-assignment tests pass against isolated Supabase; browser refresh-token persistence is reviewed; and rollback is rehearsed. No schema or policy change is authorized by this document.
