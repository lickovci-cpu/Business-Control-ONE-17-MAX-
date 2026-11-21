# BCO Cloudflare migration audit

Audit date: 2026-11-21
Migration branch: `infra/bco-cloudflare-preview`
Base commit: `8bd883535d3d09818e2fe76778db863f41279fee` (current `feature/autonomous-outreach` head at audit time)

## Safety boundary

- This branch is isolated from `main`, Vercel production, and the live Supabase database.
- No production domain, DNS, Vercel project, Supabase schema, row, storage object, or secret was changed during this audit.
- Do not enable cron, autonomous outbound, prospecting, or any message sending in preview.
- Do not create a second CRM or duplicate lead/content tables.
- Never put Supabase service credentials or integration secrets in browser code or Git.

## Verified platform state

- Supabase project `vjzzvopwecmwuccdidzq` is `ACTIVE_HEALTHY`.
- The live database is PostgreSQL 17.6.
- Live counts at audit time: `leads=10`, `automation_runs=651`, `content_items=40`, `app_snapshots=1`, `lead_followup_queue=8`, `ai_runs=35`, `ai_approvals=0`, `webhook_events=6`, `merch_prospects=149`, `media_assets=0`.
- RLS is enabled on `leads`, `automation_runs`, and `content_items`; their policies scope access through organization membership.
- `bco-media` and `job-media` are private Storage buckets. Existing `bco-media` policies scope paths to organization membership.
- `lead_followup_queue` is a `security_invoker=true` view; anonymous SELECT is not granted.
- `webhook_events.dedupe_key` has a unique index.

## Data model rule

The live `leads` table uses `organization_id`, not `project_id`. Existing project separation is represented by organization IDs/slugs:
- FVE: `09fb6fc9-7ea9-46ac-a84b-bd9952784c0c`
- NŘŠM / merch: `d2751286-da99-42c0-b8ac-6a2da8ecdabf`
- MazliPrint: `2d971414-9329-4d0b-94df-66cb8413f00c`

Preserve this live model for the migration. Do not add a parallel CRM or make a speculative schema change to introduce `project_id`.

## Verified migration blockers

1. The live BCO Vercel domain returned HTTP 402 during this audit. The latest Vercel deployment returned by the project API was a preview deployment from 2026-11-12, not a production deployment.
2. The deployed BCO code uses Upstash/Redis REST through `KV_REST_API_URL` and `KV_REST_API_TOKEN` for key-value state and locks. Those variables were not present in the Vercel project's environment-variable names at audit time.
3. `api/upload.js` uses `@vercel/blob` and requires `BLOB_READ_WRITE_TOKEN`; that variable was not present. Replace this with the existing private Supabase Storage bucket `bco-media`, respecting its current RLS/path rules.
4. `api/cron.js` uses Redis lists/sorted sets and locks. `api/outbound-cron.js` and `api/merch-cron.js` also use Redis locks. `automation-tick.js` reads and writes business data through Supabase and treats KV as optional for its core tick.
5. The existing `api/integrations/webhook.js` already writes through Supabase REST, uses an integration secret, organization mapping, and a unique webhook dedupe key. Preserve its validation and idempotency when porting it.
6. The deployed NŘŠM and MazliPrint inquiry bridges still target the Vercel BCO webhook URL. They must not be redirected until the replacement endpoint is deployed and tested.
7. The Supabase Edge Function `bco-command-center` has JWT verification enabled, but its search path selects `name,email,company_name,priority` from `leads`; those columns do not exist in the live `leads` schema. Fix and test this separately before relying on that search action.
8. The Vercel project contains server-side secrets, but no secret values were read or copied during this audit.

## Recommended migration sequence

1. Build a Cloudflare Workers + Static Assets preview from this isolated branch. Keep the existing Supabase project as the only source of truth.
2. Port and test the authenticated read-only API surface first.
3. Port the BCO webhook while preserving its allowlist, organization mapping, validation, and unique dedupe behavior. Do not test writes against live customer data.
4. Replace Vercel Blob with the existing private `bco-media` bucket; test user JWT + RLS access and private object retrieval.
5. Replace Redis-dependent state/locks with a Supabase-backed queue/claim design using existing schema where it genuinely fits. Add no table until schema, RLS, backup, and rollback are reviewed.
6. Port scheduled work only after the queue is tested. Keep all cron and outbound dispatch disabled in preview; do not call Hunter, Gemini, Meta, Outlook, or other potentially billable providers without explicit approval.
7. Test login, read-only CRM, inquiry validation, uploads, mobile/desktop, and failure handling before any production switch.

## Rollback

The migration branch is disposable and can be abandoned without changing the current Vercel project or Supabase. Production DNS, Vercel deployments, Supabase schema/data, and existing automations remain untouched until a separately approved cutover plan exists.
