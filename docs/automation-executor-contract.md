# BCO automation executor — contract and fail-closed design

Status: DESIGN ONLY. No Edge Function is deployed and no production secret or migration is assumed to exist.

## Trust boundary

The Cloudflare scheduler is a caller, not a source of authority. The executor accepts only POST requests over HTTPS with a bearer token held in a Cloudflare Worker secret. Compare the supplied token against `AUTOMATION_EXECUTOR_TOKEN` without logging either value. Reject missing configuration, invalid JSON, invalid UUIDs, wrong methods, or failed authentication.

The request may contain `run_id`, `automation_id`, and `organization_id`. Treat all other request fields (including `action_config` and `trigger_config`) as untrusted hints. Reload all authoritative configuration from Supabase.

## Required database checks, in order

1. Load `automation_runs` by the exact `id = run_id`, `automation_id`, and `organization_id`. Require `status = 'running'` and a non-expired `lease_expires_at`. A missing row, mismatched tenant, completed run, or expired lease is a hard rejection.
2. Load `automations` by both `id = automation_id` and `organization_id`; require `active = true`. Read `action_config` and `trigger_config` from this row only.
3. Resolve `action_config.agent` to `ai_agents.slug` with the same `organization_id`; require `active = true`. Never resolve an agent by slug alone.
4. Check the configured operation against `ai_agents.allowed_actions`. The scheduled entrypoints are orchestration envelopes, not permission grants:
   - `autonomous_tick` is accepted only for the `ceo` agent with `config.mode = 'autonomous-planner'`; each proposed sub-action must independently pass the allowlist.
   - `audit_registered_websites` is accepted only for the `web` agent; concrete work must map to `read_site` / `audit_site`.
   - `classify_new_messages` is accepted only for the `email` agent; concrete work must map to `read_email` / `classify_email`.
   Unknown agent/action pairs are rejected.
5. Read `autonomy_level`, agent `config`, and `ai_approvals`. Drafting, reading, research, scoring, and recommendations may run only when explicitly present in `allowed_actions`. Any send, publish, schedule, spend, external write, or production deployment requires a matching `ai_approvals` row with the same organization, agent, action type, run identifier in its payload, `status = 'approved'`, and `executed_at IS NULL`. Approval for one action must not authorize another action or another run. No approval means no external side effect.

## Provider gate

Before starting model work, require a configured provider identifier, model, endpoint, and server-side provider key (for example `AI_PROVIDER`, `AI_PROVIDER_MODEL`, `AI_PROVIDER_URL`, and `AI_PROVIDER_API_KEY`). Read them only from Edge Function secrets/environment; never from the request, database content, browser, or source code. If any required provider setting is absent, reject with `503 PROVIDER_SECRET_MISSING`. Do not claim the run succeeded and do not call an external provider.

No provider secret has been verified as available for this project. Therefore the executor must remain blocked until the operator configures one securely.

## Audit and idempotency

- Record each trusted execution attempt in existing `ai_runs` with `organization_id`, agent slug, task, provider/model (when available), start/completion timestamps, structured input, output, and error.
- Record `automation_run_started`, `automation_run_blocked`, `automation_run_completed`, or `automation_run_failed` in `ai_agent_events`; include `run_id`, `automation_id`, and a concise reason in JSONB payload. Never include tokens, provider keys, email bodies, or other secrets in logs.
- Store the originating automation run ID in `ai_runs.input.automation_run_id`. Before implementation, add a staging-tested partial unique index on `(organization_id, (input->>'automation_run_id'))` for rows that contain that key, or implement an equivalent transaction/RPC. A read-then-insert check alone is not race-safe.
- Finish only the exact running `automation_runs` row and exact `automation_id`; do not let a stale executor finish a different tenant's run.
- Return `{ ok: true }` only after the audit writes and approved internal work have succeeded. Return a non-2xx error on any refusal or incomplete operation.

## Initial release scope

The first release should be draft/read/research only. Do not implement email sending, social publishing, website publishing, payment, paid API purchases, or production deployment in this executor. Those remain separate approval-gated workflows. No provider call or external side effect is allowed until the provider secret, adapter, approval check, and tests are all present.

## Acceptance tests

- wrong/missing token; wrong tenant; wrong automation; expired lease; inactive automation; inactive agent; agent slug collision across organizations;
- action not in `allowed_actions`; invalid orchestration envelope; approval absent, wrong action, wrong run, wrong tenant, already executed;
- missing provider secret refuses without a provider request;
- repeated delivery of the same `run_id` creates one `ai_runs` record;
- all blocked/failed attempts produce an audit event without leaking secrets;
- no outbound side effect occurs in any test.
