# BCO technology review — 2026-11-21

## Decision

**Do not replace Supabase. Keep Supabase Postgres/Auth/Storage as the single source of truth, Cloudflare Workers for the PWA edge and shared scheduler, and evaluate Supabase Edge Functions for authenticated database-heavy APIs. Keep Vercel as a compatibility bridge until each route is ported and verified.**

This is the lowest-risk, lowest-cost path for the existing BCO system. A platform migration now would consume time without solving a current blocker and would introduce a second migration of identity, storage, authorization, and data.

## Fit against BCO requirements

| Platform | What it does well | Fit / limitation for BCO | Decision |
|---|---|---|---|
| Supabase | PostgreSQL, Auth, Storage, PostgREST, SQL functions, RLS, Edge Functions | Existing organization/member/job policies protect the CRM; relational data fits BCO. Edge Functions provide a natural RLS-first home for database-heavy endpoints | KEEP as source of truth + API candidate |
| Cloudflare Workers | Edge HTTP, static assets, Cron, Queues, R2 | Excellent low-cost PWA/static edge and scheduler; Free has 10 ms CPU and 50 subrequests, so database-heavy fan-out should stay small | KEEP for PWA edge + dispatcher |
| Vercel | Current Node API routes and deployment compatibility | Existing routes depend on Node patterns and `@vercel/blob`; replacing before porting creates downtime risk | TEMPORARY COMPATIBILITY |
| Neon | PostgreSQL, branching, Managed Better Auth, Data API, Object Storage, Functions, AI Gateway, Realtime (beta) | Stronger free DB headroom and no inactivity pause; still not a drop-in replacement for Supabase Auth, Storage RLS, PostgREST, or existing policies | DO NOT MIGRATE |
| Firebase / Firestore | Mature auth and document database | BCO is relational and already depends on Postgres joins, constraints, SQL functions, and RLS; migration would require redesigning data and security rules | DO NOT MIGRATE |
| Appwrite | Integrated backend services and self-hosting option | Different data/API model; cloud free tier still pauses inactive projects and limits resources; self-hosting adds maintenance | DO NOT MIGRATE |

## Free-tier facts checked on 2026-11-21

- Supabase Free (confirmed for the connected BCO organization): 500 MB database per project, 1 GB file storage, 50,000 MAU, 5 GB uncached + 5 GB cached egress, maximum two active projects, and projects may pause after one week of low activity. Free tier has no automatic backups and does not include leaked-password protection. No upgrade is recommended under the zero-cost rule; keep password policy/MFA strong and maintain an external backup/restore drill.
- Cloudflare Workers Free: 100,000 requests/day, 10 ms CPU and 50 subrequests per invocation; the account has a limit of five Cron Triggers. Static asset requests are free. One shared dispatcher uses one trigger, leaving room for four others.
- Supabase Edge Functions Free: 500,000 invocations/month, up to 100 functions per project, 150 seconds wall-clock and 2 seconds CPU per request. This is a strong candidate for database-heavy/authenticated APIs, while Cloudflare remains the PWA edge and cron dispatcher. Edge Functions run Deno, so each Node/Vercel route still needs a tested port.
- Cloudflare Queues Free: 10,000 operations/day and 24-hour message retention. Use only as optional delivery/wakeup transport; do not replace the durable SQL outbox with a queue whose free retention is one day.
- Neon Free: up to 100 projects, 1 GB Postgres storage per project (20 GB account-wide), 100 CU-hours/month per project, up to 2 CU, 5 GB Object Storage, and 1 million Function invocations per project. It does not pause for inactivity; compute scales to zero after five minutes. Managed Better Auth is included, while Realtime is still beta. This is now a credible all-in-one alternative for new projects, but migrating BCO would still require replacing its Supabase Auth, Storage RLS, PostgREST, and existing policies.
- Firebase Firestore Free: 1 GiB stored data, 50,000 document reads/day, 20,000 writes/day, and 10 GiB outbound transfer/month. It is a different NoSQL model, not a low-risk replacement for BCO's relational schema.
- Appwrite Free: 5 GB bandwidth, 2 GB storage, 75,000 MAU, 750,000 executions/month, one database, one bucket, and two functions per project; the organization is limited to two projects and inactive projects pause after one week.

## Recommended architecture

1. **Supabase Postgres** remains the only CRM/business source of truth. Keep `organization_id`, memberships, RLS, current lifecycle, payment states, and audit records here.
2. **Supabase Auth** remains the user identity provider. Every organization-scoped API must verify the JWT and resolve membership; never authorize with `bc_session`, a client-supplied UID, or an organization ID alone.
3. **Supabase Storage** remains the private document/media store while its RLS is useful. Harden `bco-media` bucket-level MIME/size settings before enabling the new upload route.
4. **Hybrid API path (preferred candidate):** Cloudflare Workers serve the PWA/static edge and shared Cron dispatcher. Supabase Edge Functions are the first candidate for authenticated, database-heavy endpoints because they provide a caller-scoped RLS client and have more CPU headroom on Free. Keep Vercel as a compatibility bridge until each Node route is ported and tested. Do not move a route based on platform preference alone; compare local integration tests, latency, and rollback first. Never expose service-role credentials in browser code.
5. **SQL integration outbox** remains durable state in Postgres. A Cloudflare Queue can optionally wake consumers, but the database row, idempotency key, lease, retry state, and dead-letter record remain authoritative.
6. **GitHub Actions + local Supabase/Postgres** remain the isolated integration test environment. Do not create extra paid staging projects or clone production data for tests.
7. **Vercel** stays available until all API routes, uploads, OAuth callbacks, cron behavior, and mobile flows are verified on the chosen Cloudflare/Supabase target. Only then consider removing Vercel cron schedules and deployment paths.

## Improvements with the highest return

- Replace browser-persisted Supabase refresh tokens with an HttpOnly refresh-cookie/BFF flow; keep short-lived access tokens in memory. Current `sbSession` in `localStorage` is a remaining XSS exposure.
- Apply `docs/bco-media-bucket-hardening-proposal.sql` only after a backup, isolated test, and explicit production approval.
- The Cloudflare private-Storage adapter is implemented and unit-tested but not wired into the static preview Worker. Before wiring it, apply bucket-level `bco-media` limits in an isolated migration and compare the same handler with a Supabase Edge Function using `@supabase/server`.
- Configure an idempotent event sink before enabling the outbox consumer. External APIs that do not support idempotency can only provide at-least-once delivery.
- Establish a verified backup/export and restore drill before any production schema migration. Supabase Free has no automatic backup allowance.
- Keep paid AI, Hunter, and outbound automation off by default. `AI_ALLOW_PAID_PROVIDERS`, `AI_ALLOW_PAID_FALLBACKS`, `AI_ALLOW_GEMINI_FREE_TIER`, `BCO_ALLOW_PAID_MERCH_APIS`, and `MERCH_AUTO_PROSPECTING` all default to false in the isolated branch. OpenRouter models explicitly ending in `:free` or `/free` remain eligible.

## Not recommended now

- No migration to Neon, Firebase, or Appwrite.
- No parallel CRM, duplicate `leads` table, or second source of truth.
- No Cloudflare R2 replacement for private Supabase Storage until the access-control and restore model is demonstrably better.
- No paid Workers, Supabase Pro, Queues overage, API credits, or paid AI fallback without explicit approval.

## Official sources

- Supabase pricing: https://supabase.com/pricing
- Cloudflare Workers pricing and limits: https://developers.cloudflare.com/workers/platform/pricing/ and https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare Queues pricing: https://developers.cloudflare.com/queues/platform/pricing/
- Neon Free plan: https://neon.com/blog/neon-free-plan-1-gb-per-project
- Firebase Firestore pricing: https://firebase.google.com/docs/firestore/pricing
- Appwrite pricing: https://appwrite.io/pricing

## Newly identified Supabase improvement

Supabase now documents `@supabase/server` for header-based user JWT authentication in Cloudflare Workers and Vercel. It provides a verified request context and a caller-scoped client that respects RLS. This is a strong candidate for the future Worker adapter and may replace some custom JWT plumbing.

I have **not** added it to this branch yet: the package's JWKS/signing-key configuration must first be checked against this project's current JWT signing mode and available environment variables. `@supabase/server` is now a stable v1 package (v1.9.2 release notes removed the public-beta/alpha designations) and officially supports Workers, Vercel, and Edge Functions. Its `withSupabase({auth:'user'})` middleware validates the bearer JWT and supplies a caller-scoped client that respects RLS, which could replace our manual `/auth/v1/user` verification and reduce custom auth code. Use the direct middleware API, not deprecated framework adapters. The current `GET /auth/v1/user` + same-user membership query is already verified and requires no new dependency. Evaluate `@supabase/server` in an isolated local test before replacing it; never fall back to unverified JWT decoding.

Official reference: https://supabase.com/docs/guides/auth/choosing-a-server-package and https://supabase.com/docs/reference/server/usage-examples


## Official sources checked 2026-11-21

- Supabase plans and quotas: https://supabase.com/pricing
- Supabase Edge Function runtime limits: https://supabase.com/docs/guides/functions/limits
- Cloudflare Workers limits (updated 2026-11-19): https://developers.cloudflare.com/workers/platform/limits/
- Neon plans and backend services (pricing page updated 2026-11-04): https://neon.com/pricing
- Appwrite plans and quotas: https://appwrite.io/pricing

Plan limits can change; re-check before any future architecture or budget decision.
