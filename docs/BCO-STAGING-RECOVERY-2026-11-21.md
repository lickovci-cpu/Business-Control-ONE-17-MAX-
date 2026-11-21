# BCO autonomous recovery report — 2026-11-21

## Status

- Staging schema baseline: VERIFIED.
- Scheduler database migration: APPLIED TO STAGING ONLY.
- Production database writes: NONE.
- Production deployment changes: NONE.
- External messages, publishing, purchases and paid services: NONE.

## Environments

- Production Supabase: vjzzvopwecmwuccdidzq (wemone).
- Staging Supabase: pflfbphulvutccvvhrot (Apppka).
- Git branch: bco/control-plane-v1.
- Production Vercel deployment remains on commit 3cc0c49e3e48fe2e75853d204af118387a47861a.

## Migration recovery

All 72 repository branches were enumerated. The GitHub migration-path history contains 11 commits. The production Supabase migration ledger contains 56 applied records, while 49 historical migration files are absent from the tracked repository history. They were not fabricated. A catalog-derived schema-only baseline was committed at supabase/migrations/20261121142726_bco_schema_only_baseline.sql.

The six GitHub migration filenames now match the exact six version values recorded by the Apppka staging migration ledger. The original baseline and scheduler migrations were preserved as applied; the subsequent privilege, sequence, MAINTAIN-grant and function-ambiguity corrections remain separate ordered migrations.

The baseline was compared with production by catalog signatures. Before the scheduler migration, the following matched exactly:

- 42 tables, 477 columns
- 180 constraints, including 83 foreign keys
- 146 indexes, 133 RLS policies
- 30 functions, 20 triggers, one view, two sequences
- table ACLs, schema ACLs and function ACLs

The staging project has PostgreSQL 17.12; production has 17.6. The schema comparison was based on object definitions, not server-version equality.

## Staging migrations

The baseline, staging-only privilege/identity-sequence corrections, scheduler migration and PL/pgSQL ambiguity correction are applied in staging. The source migration file was repaired to contain one complete claim/finish/audit function set. The claim RPC uses qualified RETURNING ar.* columns.

## Scheduler test results

- 20 concurrent claimers / one automation: 1 claim.
- 20 concurrent claimers / 20 automations: 20 unique claims.
- Same-slot repeat: 0 duplicate run rows.
- Expired lease: old run failed and lease cleared; new slot reclaimed.
- Non-expired lease: skipped.
- Wrong tenant finish: rejected.
- Correct tenant finish: completed.
- Future retry: blocked; due retry: claimed despite the normal interval gate.
- Two concurrent audit writes for one automation run: one ai_runs row, same returned ID.
- Non-service-role claim: rejected.
- Rollback rehearsal: completed inside a transaction and rolled back; all new objects remained present.
- Test organization and all synthetic rows: deleted; zero rows remain for that organization.
- GitHub Actions runtime, npm check, smoke, control-plane, API and npm test: SUCCESS.

## Production scheduler findings

The production Vercel configuration contains:
- /api/automation-tick every 5 minutes
- /api/cron every 5 minutes
- /api/merch-cron every 6 hours

The current api/automation-tick.js is the legacy runner. It does not call the new atomic claim/finish RPCs. It falls back to Supabase-only mode when KV is absent, which means no distributed KV lock. Production automation records show the latest completed runs on 2026-11-13. Vercel runtime logs showed no matching invocations in the last hour; no runtime errors were returned in the last 24 hours. This does not prove the Cron service itself is disabled, but current business automation execution is not evidenced.

Production environment names include CRON_SECRET and Supabase server credentials. No KV_REST_API_URL, KV_REST_API_TOKEN, HUNTER_API_KEY, AUTOMATION_EXECUTOR_URL or AUTOMATION_EXECUTOR_TOKEN were found in the listed production environment variables. Therefore the existing outbox and merch Cron routes are not fully configured. The automation Worker/executor is not deployed or wired in Cloudflare.

A separate production pg_cron job runs public.maintenance_cleanup() daily at 03:17 UTC. It has 30 successful runs in the last 30 days; the latest succeeded on 2026-11-21 at 03:17 UTC. This is a retention cleanup, not a duplicate business scheduler, and was left untouched.

Vercel's check for the new branch deployment reports the account-blocked failure. The existing production deployment remains READY. No attempt was made to bypass the block.

## Remaining blockers

1. Vercel account deployment block.
2. Missing KV and Hunter environment configuration for existing outbox/merch Cron routes.
3. No deployed Cloudflare Worker or staging executor endpoint.
4. Legacy production automation tick is not yet replaced by the atomic claim/finish runner.
5. The 49 missing historical migration files remain unrecovered; the schema-only baseline is the reproducible source for staging.
6. Existing Supabase advisor warnings remain: three RLS-enabled tables without policies, 14 authenticated-executable security-definer functions, and 84 unused-index informational findings. No production security or index changes were made.
7. CI dependency installation reported 3 npm audit findings (1 moderate, 2 high); no automatic upgrade was run.

## Safety

No production SQL was applied. No production Cron was edited or disabled. No production data was copied into staging. No secrets were printed or copied to the browser. No paid service was enabled. All staging test data was removed and verified absent.


## 2026-11-21 — E2E continuation

### Code and CI

The branch `bco/control-plane-v1` was updated through commit `762a92531e384d2ff5fdd834b4491a9148dd2c8e`. The Control Plane Runtime GitHub Actions push workflow completed successfully for that commit (run 232). This validates the repository's checks and tests; it does not constitute a live Edge Function or Worker E2E test.

Executor changes:
- The executor now attempts `record_bco_executor_audit` before terminal `finish_bco_automation_run`.
- Every terminal rejection after an exact, active, organization-scoped run is loaded attempts a failed finish with the existing 5/15/60-minute retry schedule.
- An expired lease is rejected without direct updates or stale finish attempts; the claim RPC remains responsible for reaping it.
- The executor returns `finalized: true` after its own finish, preventing the Worker from finishing the same run twice.
- Missing provider configuration returns `PROVIDER_SECRET_MISSING`; even with provider secrets configured, this release returns `PROVIDER_ADAPTER_NOT_IMPLEMENTED`. No AI provider request or paid inference is possible in this code path.

Worker changes:
- The scheduler source and preview server are combined in one Worker source/config targeting the existing name `bco-cloudflare-preview`.
- The Worker pins `SUPABASE_PROJECT_REF` and validates that it is not the production project before any database request.
- It dispatches a batch of up to 20 runs concurrently.
- On an executor transport/protocol error it re-reads the exact run, writes a scoped fallback audit where an agent can be resolved, and calls finish only while the exact lease remains active. A stale lease is left to the database reaper.
- The Worker configuration contains one intended `*/5 * * * *` schedule. This configuration is committed only; it has not been deployed remotely.

The static executor and worker tests were updated. GitHub Actions reports success for the latest source commit. The Worker test covers 20 mocked dispatches, tenant pinning, executor-owned finalization and fallback retry/audit. Real database claim concurrency, tenant checks, retry and idempotency were already verified in the previous staging run above.

### Staging Edge Function deployment

- `automation-executor` was deployed to Supabase project `pflfbphulvutccvvhrot` in Apppka only.
- Remote status: ACTIVE, version 1; deployment checksum `58529cc76f8bf77366545245ba83274d11c300e7654f4d20d6bbe4dcc5a75958`.
- `verify_jwt=false` is intentional: the function validates its own bearer token in constant-time comparison. If `AUTOMATION_EXECUTOR_TOKEN` is missing, it returns `503 EXECUTOR_TOKEN_NOT_CONFIGURED`.
- The function's custom secret presence cannot be enumerated through the connected Supabase tools. No secret values were read or printed.
- No invocation was made because the remote Cloudflare Worker currently has no secret bindings. Supabase unified logs showed only `pgbouncer_logs` in the inspected one-hour window; no function invocation/runtime evidence was available.

### Current Cloudflare state

Read-only Cloudflare API inspection found three scripts:
- `bco-cloudflare-preview`
- `nrsm-streetwear-preview`
- `platform-health-probe`

All three currently have zero Cron schedules. The existing `bco-cloudflare-preview` has zero secret bindings and zero ordinary bindings. Its existing static preview deployment was not updated. No new Worker or Cron trigger was deployed.

The Cloudflare account's Billing Read scope is unavailable to the connected OAuth integration (billing usage endpoint returned HTTP 403). Therefore the current account subscription cannot be independently verified. Official Workers Free documentation currently specifies 100,000 requests/day, 10 ms CPU per invocation, 128 MB memory, 50 subrequests/request and five Cron Triggers per account. These documented limits do not prove the account itself is on Free. No Cloudflare resource or paid plan was purchased.

### Acceptance status and blockers

- Supabase Apppka organization: Free plan; BCO-STAGING: ACTIVE_HEALTHY.
- Edge Function staging deployment: VERIFIED.
- Edge Function custom secret presence: UNVERIFIED through current connector.
- Existing Cloudflare Worker source/config: PREPARED IN BRANCH, NOT DEPLOYED.
- Cloudflare secret bindings: BLOCKED; remote secret list is empty.
- Cloudflare Cron Trigger: NOT DEPLOYED; remote schedule list is empty.
- Worker → claim → executor → finish → ai_runs: NOT VERIFIED end-to-end.
- Real 20-way E2E, retry, lease, tenant and idempotency tests: NOT RUN. Only CI mocks plus the previously completed direct DB tests are verified.
- Runtime logs/errors and E2E rollback: NOT TESTED because the Worker has not been enabled.
- Cloudflare current account plan: UNVERIFIED because Billing Read scope is not available.

Required server-side bindings before continuing:
- Supabase BCO-STAGING Edge Function secret: `AUTOMATION_EXECUTOR_TOKEN`.
- Existing Cloudflare `bco-cloudflare-preview` Worker secrets: `AUTOMATION_EXECUTOR_TOKEN` (same value) and staging `SUPABASE_SERVICE_ROLE_KEY`.
- The non-secret staging variables are already present in the committed Wrangler config; no client-side secrets are used.

No Cloudflare Worker deployment, Cron trigger, Supabase SQL, production Edge Function, production Vercel deployment, production Vercel Cron change or paid AI call was made. Production Supabase `wemone` remains untouched.
