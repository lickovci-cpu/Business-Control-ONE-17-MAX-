# MASTER Project Registry

Updated: 2026-10-01

## Rule
This repository is the canonical BCO application source. Do not continue work in legacy/duplicate app repositories or old Vercel projects unless explicitly needed for recovery.

## Active portfolio

### BCO — Business Control ONE
- GitHub: https://github.com/lickovci-cpu/Business-Control-ONE-17-MAX-
- Vercel project: https://vercel.com/wemone-5402s-projects/business-control-one
- Production: https://business-control-one.vercel.app
- Current production deployment: dpl_E9giy6DP9GmVzsq3pw4N4xr6Km5n
- Current production commit: 63e791a78a6984a375d0c26c6c5d21c43bb23966
- Supabase: https://supabase.com/dashboard/project/vjzzvopwecmwuccdidzq
- State: production deployment READY; /api/session returns HTTP 200 with configured=true and authenticated=false without a user session.
- Current runtime: only Node DEP0169 deprecation warnings observed in the last 24h; historical CRM_DB_NOT_CONFIGURED errors are older and tied to legacy project contexts.
- Supabase: ACTIVE_HEALTHY; FK performance indexes applied for ai_agent_events.agent_id, ai_approvals.agent_id and app_snapshots.user_id.

### NŘŠM
- GitHub: https://github.com/lickovci-cpu/nrsm-streetwear-current
- Vercel project: https://vercel.com/wemone-5402s-projects/nrsm-streetwear
- Production: https://nrsm-streetwear.vercel.app
- State: production surface is active; Metricool is connected to Facebook, Instagram and TikTok.
- Remaining commercial blocker: payment / fulfillment / legal / final commerce-flow verification.

### MazliPrint
- Vercel project: https://vercel.com/wemone-5402s-projects/mazliprint-final
- Production: https://mazliprint-final.vercel.app
- State: landing/funnel is active.
- Remaining blocker: canonical source, real upload/preview, fulfillment, payment, legal and end-to-end order flow.

### FVE / Jihočeské střechy a FVE
- BCO organization: fve
- Public website: NOT VERIFIED.
- BCO CRM / agents / automation: EXISTS.
- Priority: intentionally deprioritized during the current NŘŠM + MazliPrint acquisition sprint.

## Legacy / duplicate Vercel projects

Do not use as primary source:
- n-m-100
- mockup-sandbox
- merch-generator
- merch-generator1
- nrsmreplituploadfixe-dzip
- business-control-app-suite
- business-control-app-suite-path-test
- business-control-cloud
- bcc-pathprobe
- leonardo
- leonardo-mcp
- dropstate-store

## Canonical operating sources

- Business state: Supabase project vjzzvopwecmwuccdidzq.
- Application/docs: GitHub repository above.
- Runtime: Vercel production.
- NŘŠM social distribution: Metricool brand 7108893.
- Business email: Outlook/Gmail for 1:1; Resend prepared as a separate transactional/opt-in provider. Current Resend domain mazliprint.cz is NOT VERIFIED / status not_started.
- Remote service acquisition: Upwork; current account has 0 Connects.
- Hermes: local Windows installation, managed separately from the cloud application; gateway process currently running.

## Current execution blockers

- Desktop Commander device is connected and online, but Hermes dashboard/browser integration is not yet verified.
- Opera Browser Connector: NOT CONNECTED.
- Hermes browser extension control is disabled in local config.
- Hermes computer_use backend is configured as CUA, but CUA driver/readiness is NOT VERIFIED.
- Publora: NOT CONNECTED / zero social connections.
- GSC Wizard: no properties connected.
