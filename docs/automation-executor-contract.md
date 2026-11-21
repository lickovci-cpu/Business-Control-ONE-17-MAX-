# BCO automation executor — contract and fail-closed design

Status: IMPLEMENTED IN BRANCH ONLY (fail-closed gate). Not deployed. The provider adapter is intentionally not implemented; the function returns a non-2xx response and records a blocked attempt until provider configuration and an adapter are reviewed. No production secret, migration or deployment is assumed to exist.

## Trust boundary
The Cloudflare scheduler is a caller, not a source of authority. The executor accepts only POST requests over HTTPS with a bearer token held in a Cloudflare Worker secret. Compare the supplied token without logging either value. Reject missing configuration, invalid JSON, invalid UUIDs, wrong methods, or failed authentication.

The request may contain run_id, automation_id, and organization_id. Treat all other request fields as untrusted hints. Reload authoritative configuration from Supabase.

## Required database checks
1. Load automation_runs by exact run_id, automation_id and organization_id. Require running status and non-expired lease.
2. Load automations by automation_id and organization_id; require active.
3. Resolve action_config.agent to ai_agents.slug with the same organization_id; require active.
4. Validate the supported envelope and every concrete action against allowed_actions:
   - autonomous_tick only for ceo with config.mode = autonomous-planner; concrete actions prioritize/recommend.
   - audit_registered_websites only for web; concrete actions read_site/audit_site.
   - classify_new_messages only for email; concrete actions read_email/classify_email.
5. Any send, publish, schedule, spend, external write or production deployment requires a matching approved ai_approvals row with the same organization, agent, action type, run_id in payload, and executed_at IS NULL. The initial release refuses all such side effects even when approval exists.

## Provider gate
Require AI_PROVIDER, AI_PROVIDER_MODEL, AI_PROVIDER_URL and AI_PROVIDER_API_KEY from Edge Function secrets. Missing settings produce PROVIDER_SECRET_MISSING. Even when configured, this branch deliberately returns PROVIDER_ADAPTER_NOT_IMPLEMENTED; no model request or external side effect is issued until the adapter is separately reviewed and tested.

## Audit and idempotency
The migration adds a partial unique index on (organization_id, input->>'automation_run_id') and record_bco_executor_audit(), which validates organization, automation and agent scope, inserts one ai_runs row per automation run, and writes ai_agent_events. Completion requires exact run_id + automation_id + organization_id, running status and an unexpired lease. Failure retry delays are 5/15/60 minutes.

## Staging acceptance
The repository contains tests/automation-executor-staging.mjs. It requires explicit staging URL/ref, a staging service-role key, and a staging organization UUID; it refuses the configured production ref. It exercises two concurrent claims, same-slot idempotency, lease expiry, wrong-tenant completion and the retry gate. Run it only after applying the migration to a disposable staging database. Rollback rehearsal remains staging-only.

## Initial release scope
Draft/read/research only. No email sending, social publishing, website publishing, payment, paid API purchases or production deployment. No production migration or deployment is authorized by these files.
