# BCO Cloudflare migration — isolated preview

Status: PREVIEW SCAFFOLD ONLY. No production routing, database writes, or secrets are configured.

## Preserved source
- Worktree branch: `infra/cloudflare-workers-preview-2026-11-21`
- Base commit: `f14414e8927acd3f5d5675e726462d50311f8f2a`
- The original `feature/autonomous-outbound-engine` worktree remains untouched, including its uncommitted changes and `.bak` files.

## Preview contract
- `GET /api/health`: static diagnostic response; does not test Supabase credentials.
- `/api/*` other than health: fail closed with 503 until the real authenticated Worker adapter is implemented.
- Static content: served from `public/` via Cloudflare Assets.
- All responses are marked noindex; no production hostname or custom domain is bound.
- No secret values, service-role keys, or integration keys are included in source.

## BCO backend migration design
1. Keep Supabase Postgres as the only source of truth. Preserve `organization_id` routing; do not introduce a parallel CRM or add `project_id` to `leads` without a separately approved schema decision.
2. Replace check-then-insert webhook dedupe with an atomic unique constraint on `(organization_id, dedupe_key)` and insert-on-conflict. Existing `webhook_events` remains the durable event receipt/audit record.
3. Add a private server-side outbox with unique `(organization_id, dedupe_key)`, bounded retries, `available_at`, lease token/expiry, attempts, and processed timestamps. Worker claims batches atomically with `FOR UPDATE SKIP LOCKED`; the claim RPC is callable only by `service_role`. No public or authenticated grants.
4. Process each event idempotently. A stable event key is propagated to the effect table or recorded completion state. A timeout after a side effect must be safe to retry; do not mark processed until all effects have committed.
5. Keep the four existing schedules from `vercel.json`: `/api/merch-cron` every 6 hours; `/api/cron`, `/api/automation-tick`, `/api/outbound-cron` every 5 minutes. Cloudflare Free has limited Cron Trigger capacity; use one scheduled Worker dispatcher that invokes four internal handlers in sequence/parallel with per-task timeouts and durable leases. Do not create four separate Cron Triggers.
6. Storage: keep `bco-media` and `job-media` private. Existing `storage.objects` policies require authenticated membership in organization/job folder paths. The current BCO app cookie is not a Supabase JWT, so a blind upload with a service key would bypass those policies. Implement a server-side authorization bridge that verifies the BCO session, resolves the user's organization membership, constrains the bucket/path, then uses the secret key only server-side. Prefer a short-lived signed upload URL after authorization. Never return service keys to the browser.
7. Preserve organization mapping for `jihoceske`, `merch`, `mazliprint`; reject unknown projects. Keep integration secret comparison constant-time and never log request secrets or full payloads.

## Upload compatibility
- Current `api/upload.js` accepts POST, checks BCO app auth, permits image/jpeg/png/webp/gif, video/mp4/webm/quicktime, application/pdf, max 4 MiB, and currently returns a public Vercel Blob object. This must not be copied as-is: both Supabase buckets are private and their RLS rules depend on authenticated user membership.
- BLOCKER VERIFIED: the existing `bc_session` token contains only `exp` and a random nonce `n`; it has no user ID, Supabase UID, or organization claim. Therefore it cannot authorize organization-scoped private Storage access. The existing `auth(req)` proves only possession of a shared app session/API key. Do not use that shared credential to guess an organization folder or grant broad service-key uploads. A safe solution requires a verified per-user identity (Supabase Auth JWT or a new signed session bound to immutable user ID + server-side organization membership lookup), then an allowlisted bucket/path and short-lived signed upload URL. Keep old endpoint untouched until auth parity and cross-organization denial tests pass.

## Rollback
- Preview rollback: remove/disable only the preview Worker deployment; no DNS changes exist.
- Production rollback (future only): retain Vercel project, current domains, original API handlers, environment variables, and database untouched until cutover approval. Repoint DNS only after full smoke tests; rollback by restoring prior DNS target. Never delete Vercel resources during migration.

## Required gates before any production cutover
- Unit tests: dedupe races, retry after timeout, expired lease reclaim, poison event quarantine, organization isolation, unauthorized user, malformed payload, max upload size, MIME allowlist, path traversal, private download denial, signed URL expiry.
- Integration tests: real Supabase staging/preview credentials, storage upload/download as two organizations, all webhook event types, all four scheduled tasks, CRM UI desktop/mobile, auth cookie/session, RLS and logs.
- Security: secret scan, dependency audit, no public service key, no permissive Storage policies, no open cron endpoint, no preview indexing.
- Operational: backup/restore proof, rollback rehearsal, alerting, idempotent re-run, documented environment variable inventory.

## Known blockers
- Supabase CLI is not installed on the connected HP. No migration was created or applied.
- No production database/schema writes were made.
- KV/Upstash and Vercel Blob env keys are absent from the inspected Vercel project.
- Existing Vercel project is returning HTTP 402, so live parity tests are blocked.

