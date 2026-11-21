# BCO automation executor — contract and fail-closed design

Status: STAGING SOURCE UPDATED; NOT DEPLOYED. The worker and executor sources are pinned to the staging project and the existing `bco-cloudflare-preview` Worker. Secrets must be installed out-of-band before the runtime can be enabled.

## Trust boundary

The Cloudflare Worker is a staging-only scheduler and caller. It uses a Supabase service-role secret only server-side for the atomic claim RPC, and a separate `AUTOMATION_EXECUTOR_TOKEN` secret to call the Edge Function. The Edge Function validates the bearer token without logging it. Missing secrets fail closed. The Worker verifies both the Supabase URL hostname and explicit project ref against the configured staging ref, and rejects the known production ref.

## Run ownership and finalization

The Edge Function owns normal finalization. It reloads the exact `run_id`, `automation_id` and `organization_id`, requires status `running` and a future `lease_expires_at`, and uses `finish_bco_automation_run` as the only finalization authority. It attempts `record_bco_executor_audit` before finish, then returns `finalized: true` so the Worker does not finish the same run twice.

If the executor cannot be reached or returns an invalid protocol response, the Worker re-reads that exact run. It writes a fallback audit when the organization-scoped agent can be resolved, and calls finish only when the row remains running and the lease is still valid. Expired leases are left to the claim RPC's reaper; no direct PATCH or stale finish is attempted. The Worker isolates errors per run and continues processing the batch.

## Required database checks

1. Load `automation_runs` by exact run, automation and organization identifiers. Require running status and a non-expired lease.
2. Load `automations` by automation ID and organization ID; require active.
3. Resolve `action_config.agent` to `ai_agents.slug` inside the same organization; require active.
4. Validate supported envelopes and every concrete action against `allowed_actions`.
5. Any send, publish, schedule, spend, external write or production deployment remains disabled in this initial release, even if an approval row exists.

## Provider gate

The executor requires `AI_PROVIDER`, `AI_PROVIDER_MODEL`, `AI_PROVIDER_URL` and `AI_PROVIDER_API_KEY` to consider provider configuration present. Missing values return `PROVIDER_SECRET_MISSING`. Even when populated, this branch deliberately returns `PROVIDER_ADAPTER_NOT_IMPLEMENTED`; it does not call any provider or perform external side effects.

## Audit and retry

`record_bco_executor_audit()` validates organization, automation and agent scope, inserts one `ai_runs` row per organization + originating run, and writes `ai_agent_events`. The partial unique index protects audit idempotency. Failure retry delays are 5/15/60 minutes. Worker fallback checks row state and lease before trying to finish, preventing stale-worker completion and double finish.

## Cloudflare deployment target

The Wrangler config now targets the existing Worker name `bco-cloudflare-preview`, not a new `bco-automation-preview` Worker. Its only scheduled trigger is `*/5 * * * *`; the scheduler is part of the same Worker that serves the preview. No second Worker or additional scheduler should be created. The static preview still uses its pinned, read-only asset source.

## Staging acceptance

- `tests/automation-executor-staging.mjs`: database claim concurrency, same-slot idempotency, lease expiry, wrong-tenant finish and retry gate.
- `tests/automation-executor-static.mjs`: fail-closed provider gate, tenant checks, audit-before-finish ordering and stale lease protection.
- `tests/automation-worker.mjs`: 20-way executor dispatch, staging target guard, executor-owned finish, fallback audit and retry finish.

Do not deploy until both Worker secrets (`SUPABASE_SERVICE_ROLE_KEY`, `AUTOMATION_EXECUTOR_TOKEN`) are configured server-side and the same executor token is installed as a Supabase Edge Function secret. No AI provider secret is required for fail-closed tests.

## Production boundary

No production Supabase SQL, Edge Function, secret, Vercel configuration, Cron or deployment is changed by this staging workflow. Production cutover requires separate approval, a backup, a tested rollback and an explicit migration plan.
