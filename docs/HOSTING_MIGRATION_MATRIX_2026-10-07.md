# BCO hosting migration matrix — 2026-10-07

## Rule

Supabase remains the business source of truth. This document is an audit artifact only. No production backend rewrite is included.

| Area | Current dependency | Cloudflare target | Risk | Current status | Required proof before migration |
|---|---|---|---|---|---|
| Static/public frontend | Vercel runtime + rewrites | Workers Static Assets | LOW | READY TO DECOUPLE | build + production customer test |
| Upload / media | `@vercel/blob`, `BLOB_READ_WRITE_TOKEN`, public Blob objects | Cloudflare R2 + signed/private access policy | HIGH | BLOCKED | upload E2E, auth/RLS, URL/access model, delete/retention test |
| `/api/upload` | Vercel Node handler `(req,res)` | Worker Request/Response adapter | HIGH | NOT VERIFIED | adapter contract + 4 MB streaming/upload test |
| `/api/cron` | Vercel Cron + KV queue + Node crypto | Worker `scheduled()` + equivalent queue/lock | HIGH | NOT VERIFIED | duplicate-send, stale-lock, retry and delivery-uncertain tests |
| `/api/merch-cron` | Vercel Cron | Worker `scheduled()` | MED-HIGH | NOT VERIFIED | merch queue E2E + timing test |
| `/api/automation-tick` | 5-minute Vercel Cron, Supabase, KV mutex, AI orchestration | Worker scheduled trigger or external scheduler | HIGH | BLOCKED FOR MIGRATION | CPU/time budget test, lock test, Supabase live E2E, AI call test |
| Request/response handlers | Multiple Vercel-style `req,res` handlers | Web-standard `Request/Response` adapter | HIGH | NOT VERIFIED | endpoint-by-endpoint contract tests |
| Auth/session | HMAC cookies, Node crypto, in-memory login-attempt lock | Web Crypto / nodejs_compat + durable rate-limit state | HIGH | NOT VERIFIED | login/logout, cookie attributes, multi-instance brute-force test |
| Security headers | `vercel.json` header rules | Worker responses + Static Assets `_headers` where applicable | HIGH | PARTIALLY READY | live header test on static + API responses |
| Webhook bridge | `/api/integrations/webhook` + shared secret + Supabase | Same BCO contract behind Worker | HIGH | DO NOT MOVE BLINDLY | live E2E, idempotency and project isolation tests |
| Supabase access | Service role REST calls | Same Supabase source-of-truth path | MEDIUM | COMPATIBLE | live RLS/organization isolation regression tests |
| `vercel.json` rewrites | Vercel-specific routing | Worker routes + SPA Static Assets | MEDIUM | MAPPABLE | route matrix + direct navigation tests |
| `maxDuration` 30–60 s | Vercel function runtime limits | Cloudflare CPU/runtime model | HIGH | BLOCKED FOR MIGRATION | workload profiling; redesign long-running jobs where needed |
| Environment secrets | Vercel project env | Worker secrets/env bindings | MEDIUM | MAPPABLE | secret inventory + production secret check |

## Current decision

1. Keep BCO production runtime unchanged.
2. Decouple NŘŠM and MazliPrint public frontends first.
3. Migrate BCO storage, cron and backend only on a compatibility branch.
4. Do not add a second CRM/order system.
5. Do not alter Supabase schema for the hosting migration.

## Migration gate

A BCO backend migration is not considered verified until all of these pass:

- build
- endpoint contract tests
- auth/session E2E
- upload/R2 E2E
- webhook E2E
- CRM live test
- automation-tick E2E
- cron verification
- security header verification
- RLS / project-isolation regression
- production customer test
