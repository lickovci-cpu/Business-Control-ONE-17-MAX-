# BCO automation readiness — 21 Nov 2026

Read-only evidence review. No automation was run and no production rows were changed.

## Existing scheduled automations

| Automation | Organization scope | Schedule | Action |
|---|---|---|---|
| CEO Autonomous Planner | NŘŠM | every 6 hours, Europe/Prague | agent=ceo, action=autonomous_tick |
| CEO Autonomous Planner | FVE | every 6 hours, Europe/Prague | agent=ceo, action=autonomous_tick |
| Email Intake → AI classification | NŘŠM | every 5 minutes | agent=email, action=classify_new_messages, provider=outlook |
| Web Health Audit | FVE | every 24 hours | agent=web, action=audit_registered_websites |

The latest recorded last_run_at values are 13 Nov 2026. The Cloudflare preview Workers have no Cron Triggers, bindings, or secret bindings.

## Why the executor is still blocked

1. There is no deployed Supabase Edge Function named bco-automation-executor.
2. The active Vercel api/agents.js contains a hard-coded agent map that does not include email or web, although both are referenced by the live automation rows and exist in ai_agents.
3. api/agents.js builds a Vercel-origin URL and calls /api/ai. That path is not portable to Cloudflare and must not be reused by the new Worker.
4. The existing api/ai.js relies on provider environment variables (Gemini, Anthropic, OpenRouter or a custom endpoint). No provider secret was migrated to Supabase or Cloudflare in this run.
5. The Outlook automation points to provider=outlook, but the BCO integration registry has no credential_ref and no last_checked_at. A connected ChatGPT Outlook connector is not a server-side OAuth credential for a Cloudflare Worker.
6. Email classification and web audits need explicit action implementations. A scheduler must not mark a run completed merely because it created a task or received an HTTP 200.

## Required executor contract

- Accept only a service_role-authenticated call from the Worker.
- Reload automation, organization, and ai_agents rows from Supabase; never trust action_config or organization_id supplied by the caller without matching them to the claimed run.
- Enforce ai_agents.allowed_actions, autonomy_level, external_actions_require_approval, and publish_requires_approval.
- Write ai_runs and ai_agent_events with the exact run lineage.
- No email sending, social publishing, pricing, or production deployment without the existing approval workflow.
- Return {ok:true} only after the action and its audit record are committed. Return {ok:false} for every incomplete or uncertain outcome.
- Use only already-approved provider credentials. No paid API, new account, or new subscription without explicit approval.

The Worker runner intentionally refuses to claim any run until AUTOMATION_EXECUTOR_URL and AUTOMATION_EXECUTOR_TOKEN are configured. This prevents false "completed" runs while the executor is missing.
