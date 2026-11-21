# Four scheduled jobs — migration preservation map

Source of truth checked in original `vercel.json` (read-only):
| Existing route | Existing schedule | Cloudflare Worker plan |
|---|---|---|
| `/api/merch-cron` | `0 */6 * * *` | Keep a six-hour due-time gate; do not run every five minutes |
| `/api/cron` | `*/5 * * * *` | Run every five minutes |
| `/api/automation-tick` | `*/5 * * * *` | Run every five minutes |
| `/api/outbound-cron` | `*/5 * * * *` | Run every five minutes |

A single Worker Cron Trigger at `*/5 * * * *` can preserve all four schedules only if a durable Postgres scheduler/lease records each job's last successful run and next due time. Each job must have its own lease/idempotency key and bounded runtime. The six-hour merch task must be due-gated. Do not make four concurrent invocations without checking existing side effects and overlap safety.

No cron trigger or production schedule has been created or changed. Before activation: test each route in isolation, verify the four due times against UTC, test duplicate ticks and expired leases, then rehearse rollback to the four original Vercel schedules.
