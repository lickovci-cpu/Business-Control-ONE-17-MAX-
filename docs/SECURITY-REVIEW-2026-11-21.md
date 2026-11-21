# BCO security review — 2026-11-21

Scope: read-only review of the currently connected Supabase project plus isolated-branch API changes. No hosted database, Storage policy, bucket setting, user, secret, DNS record, or production Worker was changed.

## Verified database posture

- `public.memberships` has RLS enabled. Authenticated users can SELECT their own membership rows; owners/admins can see organization membership rows. INSERT/UPDATE/DELETE are restricted to owner/admin roles, and owner membership is protected from normal removal or role changes.
- `storage.buckets`: `bco-media` and `job-media` are both private.
- `job-media` is restricted to 15 MiB and JPEG/PNG/WebP/PDF MIME types.
- `bco-media` currently has no bucket-level size limit and no MIME allowlist. A valid member JWT can call Storage directly, bypassing the 4 MiB application-route limit. This is a real go-live blocker. `docs/bco-media-bucket-hardening-proposal.sql` is a proposal only; not executed.
- `storage.objects` policies scope `bco-media` to organization membership. `job-media` uses `private.can_access_job(org, job)` for insert/select/update; deletion is owner/admin/manager only.
- `booking_throttle`, `integration_webhook_tokens`, and `webhook_events` have RLS enabled with no user policies. Read-only grant inspection confirmed `anon` and `authenticated` have no SELECT privilege; `service_role` has SELECT. This is deny-by-default, not a public exposure.

## Supabase Security Advisor — reviewed findings

- Health advisor: no findings.
- Security advisor: 3 informational RLS-without-policy findings above; 14 warnings for public `SECURITY DEFINER` functions callable by `authenticated`; 1 warning that leaked-password protection is disabled.
- The 14 function definitions were read-only inspected. Each checks `auth.uid()` before acting and enforces the relevant owner/admin/manager, invitation-token/email, or assigned-job boundary. `create_my_organization` is intentionally self-service and creates membership for the calling UID. No immediate evidence of an unauthenticated cross-organization path was found.
- The advisor warnings remain valid hardening opportunities: keep `search_path` controlled, schema-qualify objects, and consider moving internal functions out of the exposed `public` API schema or revoking EXECUTE where no client RPC is needed. No production function grants were changed.
- Leaked-password protection is not included in the connected organization's current Free plan. It cannot be enabled without a paid upgrade, which is not authorized. No upgrade or dashboard setting was changed; use strong password rules and available MFA, and revisit only if the plan changes.

## Performance advisor

- 46 indexes are currently reported as unused. This is not proof that they are unnecessary: some support infrequent admin, audit, job, or future workflow queries. No index was dropped. Review query plans and workload history before any removal.

## Isolated application hardening

- Organization-scoped CRM, commercial, and merch-revenue user reads/writes now require a Supabase user JWT and forward that same JWT with the publishable key to PostgREST. They no longer select the service-role credential for those user requests. The merch-revenue cron path is the only route in that module allowed to use the server credential.
- Health diagnostics now require admin membership in the requested project, return only that project's Meta connection status, and report actual private-Storage/backup flags instead of a false 'snapshots active' indicator.
- Outlook connection status is now restricted to a merch owner/admin and the fixed NŘŠM organization; it cannot query an arbitrary organization ID.
- The Storage API and Cloudflare adapter verify the user through Supabase Auth, derive UID from the verified response, and query membership using the same JWT. They never authorize with `bc_session` and never use service-role credentials for Storage.
- Private Storage feature flag remains off. Static Cloudflare preview still reports `backend=not-connected` and returns 503 for API routes.
- The legacy public Vercel Blob upload route remains disabled by default and returns 410 unless a server-side legacy flag is explicitly enabled.
- AI cost controls now block OpenAI, Claude, custom endpoints, paid OpenRouter models, and Gemini unless explicitly permitted. Gemini's free-tier use has a separate `AI_ALLOW_GEMINI_FREE_TIER` opt-in because the same API key can become billable when free quotas are exceeded. The default is false; only OpenRouter models explicitly ending in `:free` or `/free` remain eligible by default.

## Remaining blockers

1. Apply and verify bucket-level `bco-media` size/MIME restrictions only after a backup, isolated migration test, rollback plan, and explicit approval.
2. Review browser refresh-token storage (`sbSession` currently uses localStorage); move to a safer HttpOnly/BFF design before broader exposure.
3. Finish end-to-end Cloudflare Worker integration and test real signed uploads/downloads against isolated Supabase Auth + RLS. Current adapters are unit-tested but not connected to the static preview.
4. The outbox SQL remains un-applied; no downstream event sink is configured. Do not enable the consumer.
5. Review remaining admin-only legacy endpoints that intentionally use service-role database calls. They have server-side role checks and fixed organization scopes, but should be migrated to caller JWT + RLS where practical.

## Change boundary

All checks above were read-only against hosted Supabase. All implementation changes are on `infra/cloudflare-workers-preview-2026-11-21` only. No production migration, DNS change, custom domain change, or production deployment was performed.
