# BCO Cloudflare workers.dev preview

Status: deployed to the isolated workers.dev hostname only.

- Worker: `bco-cloudflare-preview`
- URL: `https://bco-cloudflare-preview.lickovci.workers.dev/`
- Worker source: `worker-github-preview.js`
- Static source: the allowlisted `public/` files from this branch only.
- API: `GET /api/health` is diagnostic; every other `/api/*` route returns 503.
- Methods: static content is GET/HEAD only.
- Headers: noindex, nosniff, no-store, X-Frame-Options DENY, same-origin-only scripts/connections/forms, inline styles only, no external images, worker-src none (service workers disabled), object-src none.
- No Supabase credentials, service-role key, BLOB token, or production backend binding is present.

## Deployment path

The GitHub Actions environment does not currently provide a usable `CLOUDFLARE_API_TOKEN`. The workflow correctly skips Wrangler deployment when that secret is empty. To finish the requested preview without waiting for a GitHub secret, the first isolated workers.dev deployment was made through the already-connected Cloudflare account integration.

This temporary Worker proxies only the fixed allowlist of static files from this exact public GitHub branch. It is not an open proxy and cannot forward arbitrary URLs. It does not connect to BCO APIs, Supabase, Vercel, or any production domain.

When `CLOUDFLARE_API_TOKEN` is configured in GitHub Actions, the normal Wrangler workflow can replace this temporary GitHub-backed Worker with the native Cloudflare static-assets deployment defined by `wrangler.toml`. That future deployment must pass the same tests first.

## Rollback

The previous Cloudflare Worker script was absent before this preview deployment. Rollback is therefore to disable the preview Worker subdomain or delete only the `bco-cloudflare-preview` Worker script. Do not change the account-level workers.dev subdomain, custom domains, DNS, or production workers.

No production database, custom domain, DNS record, Vercel project, or production worker was changed.

## Scheduled jobs

The original `vercel.json` still contains all four schedules:

- `/api/merch-cron` — `0 */6 * * *`
- `/api/cron` — `*/5 * * * *`
- `/api/automation-tick` — `*/5 * * * *`
- `/api/outbound-cron` — `*/5 * * * *`

The preview intentionally has no Cron Trigger and does not execute business jobs. Production scheduling remains on the existing configuration until a separate scheduler migration is backed by idempotency tests, a rollback plan, and explicit approval.

## Live preview verification

Verified from the connected Windows device:

- `GET /` — HTTP 200; Czech HTML and mobile viewport meta present.
- `GET /api/health` — HTTP 200; explicitly reports `preview=true` and `backend=not-connected`.
- `GET /app.js`, `GET /styles.css`, `GET /manifest.webmanifest`, `GET /robots.txt` — HTTP 200.
- SPA pages `/projects`, `/fve`, `/nrsm`, `/mazliprint` — HTTP 200.
- Unknown static path — HTTP 404.
- `GET/POST/PUT/PATCH/DELETE/OPTIONS/HEAD /api/leads` — HTTP 503 (fail-closed).
- `POST / ` and `OPTIONS / ` — HTTP 405.
- Live root and health responses expose the restrictive CSP, `X-Frame-Options: DENY`, and `X-Robots-Tag: noindex, nofollow, noarchive`.

The preview is a static UI demonstration. It does not authenticate, save leads, upload files, execute automations, or run cron jobs. The service-worker policy is deliberately disabled to prevent cached production behavior and ensure security headers are not stripped by a client-side service worker.
