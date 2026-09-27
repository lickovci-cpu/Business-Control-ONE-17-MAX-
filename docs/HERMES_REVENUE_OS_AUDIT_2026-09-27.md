# HERMES / REVENUE OS AUDIT — 2026-09-27

## Executive state

The system is no longer primarily a build problem. The main objective is acquisition and conversion.

Current architecture:
Hermes → research/orchestration
BCO → CRM/control/execution/audit
Supabase → source of truth
GitHub → canonical code/docs
Vercel → production
Outlook → outbound communication
Metricool → NŘŠM FB/IG/TikTok distribution
Upwork → remote service acquisition
n8n → automation proof asset

## Verified production surfaces

### BCO
Production: https://business-control-one.vercel.app
Latest deployment:
- dpl_CjMPfHvrERsxZ2LJ1RxWrBzqREh3
- commit a3de47c3e54cc8aa84a68dff5c0097b39066001b
- READY at audit
- no runtime errors in last 24h

UI includes command center, cash sprint, control room, content worker, content engine, campaign factory, reels studio, autopilot, settings/recovery.

### NŘŠM
Production: https://nrsm-streetwear.vercel.app
Latest deployment:
- dpl_7c4nGbZLMWRrV1eqr5HQ68CCrRcf
- commit 84ef55c0495951bbee6e21960262d2a4721528f4
- READY
- no runtime errors in last 24h

### MazliPrint
Production: https://mazliprint-final.vercel.app
Deployment:
- dpl_CVjRqK2a6tLL6cNRrbMjVN5h6Lbm
- READY
- no runtime errors in last 24h

The public surface is a lead funnel, not a fully verified checkout/fulfillment system.

## Supabase inventory

As of the audit:
- 3 organizations
- 2 CRM leads
- 4 opportunities
- 8 open/in-progress/blocked tasks
- 69 NŘŠM prospects
- 88 NŘŠM outreach drafts
- 32 NŘŠM products
- 0 NŘŠM orders
- 31 content_items
- 36 AI agents
- 0 ai_runs recorded
- 0 automation_runs recorded at the audit moment

Active automations:
- FVE CEO planner — 6h
- NŘŠM CEO planner — 6h
- Email Intake → AI classification — 5m
- Web Health Audit — 24h

## Automation finding

Before the latest fix, /api/automation-tick was called every 5 minutes but returned 409.

The implementation treated a missing KV configuration as a lock conflict.

Fix committed:
a3de47c3e54cc8aa84a68dff5c0097b39066001b

New behavior:
- KV lock when configured
- Supabase-only scheduler mode when KV is not configured
- lockMode visible in results
- business state remains in Supabase

The new deployment is READY. Post-fix cron execution still needs a fresh scheduled invocation to create the first new automation_runs evidence.

## Hermes local state

Last verified local diagnostic:
- Hermes v0.21.5+2583.gf077152
- Windows 10 AMD64
- Python 3.14.7
- default profile
- solar-pro4:free via Nous Research Portal
- 0 MCP servers
- 53 enabled skills
- gateway running
- 4 cron jobs including revenue-radar
- external browser/code tooling installed
- no paid provider API keys configured
- backup exists at C:\Users\licko\hermes-backup-2026-09-26-211606.zip

Do not blind-update Hermes. Local version is ahead of the official stable tag and upstream currently has a pinned dependency with a security advisory.

## NŘŠM distribution

Metricool brand:
- 7108893
- Europe/Prague
- Facebook Page connected
- Instagram @nrsm.merch connected
- TikTok connected

Scheduled:
- 5 existing FB/IG posts
- 3 new TikTok posts for 2026-10-02, 2026-10-05 and 2026-10-07
- all three new TikTok posts set to auto-publish

Analytics are currently too new for strong optimization.

## Outbound executed

Warm:
- Footfest follow-up sent
- Metafiziq follow-up sent

FVE:
- OPRAVÍME HNED attempted, recipient spam-blocked
- Gerath BAU attempted, recipient spam-blocked

New NŘŠM acquisition:
- Fabric / jiri@fabric.cz sent
- DNBe HearD. / vasek@dnbeheard.cz sent
- Ankali / ankali@anka.li sent

No duplicate prior Outlook messages were found for those three new recipients. No delivery-failure message was found immediately after sending.

## Current revenue assets

### n8n service
Local demo:
- lead intake + validation + scoring + routing
- 13 nodes
- no paid API dependency
- last known validation: 10/10 logic tests and 71/71 structural checks
- offer: fixed-scope SMB automation service

### Upwork
- connected account
- profile IN_PROCESS
- 0 Connects
- proposals currently blocked by balance
- current target jobs are being recorded but no proposal is being submitted without Connects and the required approval flow

## Security / technical debt

Supabase advisor findings include exposed SECURITY DEFINER functions in the public schema and disabled leaked-password protection. Performance advisor also found unindexed foreign keys and unused indexes.

These are real technical debt items but are below revenue execution unless they create an immediate security exposure or block production use.

## Maximum-distribution model

Acquisition should operate through six lanes:

1. Warm B2B follow-up
2. Targeted direct outreach
3. Social distribution
4. Search/discovery
5. Marketplaces/subcontracting
6. New evidence-backed opportunities

For every lane:
signal → verified buyer → BCO record → personalized action → response → offer → payment → learned result.

## Human interaction target

The human should normally only:
- approve a high-impact external action;
- provide a missing credential/permission;
- perform physical work.

Everything else should be prepared, tracked and audited by the system.
