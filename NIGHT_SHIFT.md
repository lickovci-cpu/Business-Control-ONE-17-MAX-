# BCO Night Shift

BCO now contains a server-side autonomous controller at `/api/autopilot`.

## What it does

Every run:

1. Acquires a distributed KV lock so overlapping runs are rejected.
2. Probes production `/api/health`.
3. Runs the existing protected `/api/cron` queue worker when health is OK.
4. Classifies the result as `healthy`, `degraded`, or `failed`.
5. Persists the latest run and a bounded history in KV under `business-control:autopilot:state`.
6. Never invents business data and never mutates source code or production configuration.

## Scheduler

`.github/workflows/bco-night-shift.yml` invokes the controller every 30 minutes and can also be started manually from GitHub Actions.

Required GitHub configuration:

- Repository variable `BCO_PUBLIC_URL` (optional; defaults to `https://business-control-one.vercel.app`).
- Repository secret `BCO_CRON_SECRET` with the exact same value as the production `CRON_SECRET` environment variable.

The workflow intentionally exits without running if the secret is missing.

## Safety boundary

Night Shift is an operations controller, not an unrestricted coding agent. It can monitor production and process the already-approved communication queue, but it does not autonomously edit the repository, database schema, RLS policies, credentials, or deployment configuration.

Code changes remain reviewable through GitHub. This boundary prevents an overnight model loop from making unverified production changes.
