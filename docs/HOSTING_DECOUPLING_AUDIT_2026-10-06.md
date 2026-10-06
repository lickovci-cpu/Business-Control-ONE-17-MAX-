# BCO hosting decoupling assessment — 2026-10-06

## Decision

Do not perform a blind Vercel replacement for BCO.

The core BCO repository is materially more platform-dependent than NŘŠM or MazliPrint. The safe strategy is:

1. Keep Supabase as the business source of truth.
2. Decouple public project frontends first.
3. Keep the BCO core on the currently configured runtime until a compatibility branch passes the full test suite.
4. Prepare a Cloudflare Workers migration as a controlled second phase.

## Verified Vercel-dependent areas

- `vercel.json` defines three cron triggers:
  - `/api/merch-cron` every 6 hours
  - `/api/cron` every 5 minutes
  - `/api/automation-tick` every 5 minutes
- Many API handlers are Vercel-style `(req, res)` functions.
- `api/upload.js` imports `@vercel/blob` and currently uses Vercel Blob for uploaded media.
- The backend contains multiple long-running endpoints configured for 30–60 second max duration.
- Security, authentication, Supabase service-role access and shared BCO website webhook routing are part of the core runtime.

## Cloudflare feasibility

Cloudflare Workers now supports Node.js compatibility, including `process.env` population and many Node built-ins, but CPU time on the Free plan is only 10 ms per invocation. Network wait does not count toward CPU time, but larger parsing, validation and AI orchestration can exceed that budget.

Cloudflare supports Cron Triggers and Workers Static Assets, so the platform is technically viable. The migration must nevertheless:

- create a Vercel-request / Response adapter for existing handlers
- route legacy `api/*.js` handlers through one Worker
- convert Vercel Blob usage to Cloudflare R2 or an equivalent storage layer
- convert Vercel cron configuration into Worker `scheduled()` handlers
- reproduce required security headers and route rewrites
- verify every API endpoint against Supabase
- run the existing BCO smoke and live integration tests
- verify automation tick, CRM bridge, auth/session, uploads and project isolation

## Recommendation

Use Cloudflare for NŘŠM and MazliPrint first.

Do not move BCO core until the migration branch has passed:

- build
- API contract tests
- CRM live tests
- BCO website webhook E2E
- automation tick E2E
- cron verification
- upload/R2 verification
- security/RLS verification
- production customer test

The NŘŠM and MazliPrint public sites can then remain independent from BCO hosting while both continue to use the same BCO integration contract.

## No duplicate business systems

The migration must not create:

- a second CRM
- a second lead store
- a second follow-up database
- a second project core
- a new parallel BCO webhook

Cloudflare is only a runtime/edge migration target. Supabase remains source of truth.
