# Four scheduled jobs — migration preservation map

Source of truth checked in original `vercel.json` (read-only):

| Existing route | Existing schedule (UTC) | Dispatcher behavior |
|---|---|---|
| `/api/merch-cron` | `0 */6 * * *` | Dispatch only at minute 0 when UTC hour is divisible by 6 |
| `/api/cron` | `*/5 * * * *` | Dispatch every five minutes |
| `/api/automation-tick` | `*/5 * * * *` | Dispatch every five minutes |
| `/api/outbound-cron` | `*/5 * * * *` | Dispatch every five minutes |

## Isolated implementation
- `workers/bco-cron-dispatcher.js` is a shared Cloudflare Scheduled handler. It uses the Cloudflare `scheduledTime` timestamp (UTC), sends authenticated POST requests to the four existing routes, and reports per-route HTTP results.
- It requires `BCO_CRON_ORIGIN` (HTTPS origin only) and `CRON_SECRET`; without either, it fails closed and makes no requests.
- `wrangler.cron-dispatcher.example.toml` is a non-deployed example. It deliberately contains no active trigger. The intended single trigger after approved cutover is `*/5 * * * *`.
- Existing route-level locks and idempotency checks remain in place. The dispatcher does not replace them.
- The new outbox consumer can be added as an optional fifth target with `BCO_OUTBOX_CONSUMER_ENABLED=true`; it is off by default and also requires the outbox feature flag, migration, and sink secrets.
- `api/merch-cron.js` now defaults `MERCH_AUTO_PROSPECTING` to `false`, so Hunter/Gemini prospecting cannot run unless explicitly enabled by server configuration. This prevents accidental paid API use.
- Unit tests cover UTC due-time routing, authenticated requests, missing secret/origin, and partial failure handling.

## Cutover boundary
No cron trigger, production schedule, DNS record, domain, or production Worker has been created or changed. The four original Vercel schedules remain unchanged. Do not activate the Cloudflare dispatcher until the API origin, Worker secrets, duplicate-run behavior, and rollback have been tested. During cutover, disable the original schedules only after the Cloudflare dispatcher is confirmed live; retain the original `vercel.json` for immediate rollback.

The dispatcher is a tested isolated prototype, not a live scheduler. A failed six-hour merch invocation is reported and is not retried every five minutes; this preserves the original six-hour cadence and avoids accidental repeated prospecting. If automatic catch-up is required later, add a durable per-job lease/last-success record in Supabase and test it before activation.
