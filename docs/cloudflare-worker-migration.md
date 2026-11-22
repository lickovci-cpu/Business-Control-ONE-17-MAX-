# BCO 17 – Cloudflare Worker API migration inventory

Read-only inventory baseline: branch `bco/control-plane-v1`, commit `910f0b0865d8c905398a395e504bb562814b404a`.

## Existing Vercel API route inventory

| Route | Existing dependencies / behavior | Cloudflare status |
|---|---|---|
| `/api/session` | Custom APP_PASSWORD, HMAC-signed HttpOnly cookie, in-memory login throttle | Replaced by Supabase staging Auth JWT validation |
| `/api/health` | APP_PASSWORD gate, Meta/comms config probes | Replaced by non-sensitive staging health |
| `/api/agents` | APP_PASSWORD, calls `/api/ai` | Not migrated; 501 |
| `/api/ai` | APP_PASSWORD, Gemini/Anthropic/OpenRouter/custom providers, optional paid fallback | Not migrated; 501 |
| `/api/comms` | APP_PASSWORD, Vercel KV REST, outbox/control ledger, external delivery providers | Not migrated; 501 |
| `/api/control` | APP_PASSWORD, Vercel KV REST, confirmation tokens, task/audit state | Not migrated; 501 |
| `/api/cron` | CRON_SECRET, Vercel KV REST, outbound communication dispatch | Not migrated; Cron automation Worker remains separate handler |
| `/api/mcp` | MCP_API_TOKEN, content-worker tools | Not migrated; 501 |
| `/api/meta` | APP_PASSWORD, Meta Graph API, project-specific Meta auth, confirmation/control ledger | Not migrated; 501 |
| `/api/meta-photo` | APP_PASSWORD, binary upload, Vercel KV, Meta Graph API, confirmation/control ledger | Not migrated; 501 |
| `/api/store` | APP_PASSWORD, Vercel KV REST | Not migrated; 501 |
| `/api/upload` | APP_PASSWORD, `@vercel/blob`, public object upload | Not migrated; 501 |
| `/api/_lib.js` | Shared Vercel helpers: Node crypto, cookies, Vercel KV REST, fetch retry, Meta Graph | Internal helper, not a route |
| `/api/_confirm.js` | HMAC confirmation token helper using Node crypto | Internal helper, not a route |
| `/api/_control.js` | Vercel KV-backed task, approval, idempotency and audit ledger | Internal helper, not a route |
| `/api/_comms.js`, `_meta-auth.js`, `_meta-config.js`, `_meta*.js` | External delivery and Meta integration helpers | Internal helpers, not routes |

## Implemented in this phase

- Workers Static Assets points to the current branch's `public/` directory.
- Existing Worker `scheduled()` handler and Cron declaration `*/5 * * * *` are retained.
- `/api/health` is a non-sensitive preview health endpoint.
- `/api/session` validates Supabase staging access tokens via Auth `/user`.
- `/api/revenue` is a strict allowlisted proxy to staging Edge Function `bco-command-center`.
- The proxy forwards the user's JWT and publishable key only; it never uses the service-role key.
- Unknown legacy API routes return explicit HTTP 501 instead of pretending to work.
- Frontend cloud/auth URL and publishable key are switched from production to staging.
- Proposal UI calls the same-origin Worker proxy, avoiding a cross-origin Edge Function request.
- Production Supabase ref is rejected by a Worker-side guard.

## Explicitly not migrated yet

AI provider orchestration, Meta publishing/OAuth, outbound communications, Vercel KV task ledger, Vercel Blob uploads, and MCP are not part of this deploy candidate. They require separate Cloudflare storage/provider design and tests. No production integration is enabled by this Worker preview.

## Deployment / rollback

This commit only prepares source and tests. It does not deploy the Worker or alter the active Cron. Keep the prior Worker version and existing Cron schedule as the rollback target. Deploy only after CI passes and the Cloudflare upload preview confirms that the existing scheduled handler and bindings are retained.
