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
