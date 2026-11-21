# BCO identity and Storage audit — 2026-11-21

## Scope and safety

Read-only inspection of the connected Supabase project `vjzzvopwecmwuccdidzq`, plus isolated Worker and local PostgreSQL tests. No production SQL, bucket settings, data, DNS, domain, or secrets were changed.

## Identity

- The BCO `bc_session` token contains expiry and nonce only; it is not a user identity.
- The isolated branch uses Supabase Auth to validate the bearer token through `/auth/v1/user`, obtains the immutable Auth UID from that verified response, and queries the matching organization membership using the same user JWT.
- The client cannot choose the UID used for authorization. Project-to-organization mapping is server-owned. Admin endpoints require `owner` or `admin`; member endpoints accept an existing membership.
- `BCO_ALLOW_LEGACY_SHARED_SESSION` defaults to `false`. A valid Supabase JWT without membership is denied even if the legacy flag is enabled.
- The browser currently stores the Supabase refresh token in `localStorage`. This is an acknowledged XSS exposure; the next security improvement is an HttpOnly refresh-cookie/BFF session. Do not describe the current client session as XSS-proof.

## Live Storage facts — read-only

`storage.objects` has RLS enabled. Both buckets are private.

| Bucket | Public | Current size limit | Current MIME allowlist |
|---|---:|---:|---|
| `bco-media` | false | none | none |
| `job-media` | false | 15 MiB | JPEG, PNG, WebP, PDF |

Current policies:

- `bco-media` SELECT/INSERT/UPDATE/DELETE require an authenticated user whose `auth.uid()` belongs to the organization UUID in the first folder segment.
- `job-media` SELECT/INSERT/UPDATE call `private.can_access_job(org_id, job_id)`. Owners/admins/managers can access organization jobs; workers must have a matching `job_assignments` row for their Auth UID. DELETE is restricted to owner/admin/manager.
- `private.can_access_job`, `private.org_role`, and `private.is_org_member` are `SECURITY DEFINER` helpers in the non-exposed `private` schema and bind authorization to `auth.uid()`. Read-only privilege checks confirmed `anon` has no `private` schema usage and cannot execute the job helper; `authenticated` can use it for the RLS policy.

### Important hardening gap

The `bco-media` bucket currently has no bucket-level file-size or MIME restriction. `job-media` allows 15 MiB while the new Cloudflare adapter intentionally accepts at most 4 MiB. A caller with a valid JWT can call the Supabase Storage API directly and bypass Worker-only size/MIME validation. RLS still prevents cross-organization and unassigned-job access, but bucket-level limits are needed to make the upload boundary universal.

I updated `docs/bco-media-bucket-hardening-proposal.sql` to:

- Require both buckets to exist and remain private.
- Set both to 4 MiB, matching the Worker/mobile upload boundary.
- Keep the appropriate MIME allowlist per bucket.
- Include rollback values observed during this read-only inspection.

The proposal is not a production migration. It is applied only to disposable local Supabase buckets in CI; it has not been run against the hosted project. Re-read the current bucket values and create a backup immediately before any future approved production change.

## Isolated implementation status

- `workers/bco-private-storage.js`: verifies Auth UID and organization membership, accepts only server-generated object paths, validates MIME and file signatures, caps uploads at 4 MiB, refuses overwrite, and returns a 120-second signed download URL. It uses the caller JWT for Storage so existing RLS remains the final authorization layer.
- `BCO_PRIVATE_STORAGE_ENABLED` defaults to false. The adapter is not connected to the public static preview Worker; the preview API remains fail-closed.
- Tests cover missing/forged JWT, cross-organization access, job path checks, size/MIME/signature checks, and short-lived signed URLs. These are isolated tests, not a production upload test.
- Five dedicated tests verify the bucket proposal. The CI local-Supabase Auth/RLS job now applies the proposal to its disposable local buckets before exercising real JWT uploads, direct MIME rejection, and the 4 MiB size limit. No production bucket settings have changed.

## Remaining blockers

1. Apply bucket-level limits only after explicit approval, fresh bucket backup, isolated execution test, and rollback validation.
2. Replace browser-persisted refresh tokens with an HttpOnly BFF flow and test login, refresh, logout, CSRF, and expiry.
3. Keep the private Storage adapter disabled until the bucket limits and end-to-end mobile upload/download have been verified.
4. Keep the SQL outbox schema unapplied until a test database run and migration/rollback review are complete. The consumer also requires a configured idempotent sink and remains disabled by default.
5. Keep the four existing Vercel cron schedules unchanged until the Cloudflare dispatcher has passed the full CI and operational overlap/duplicate-execution review.
