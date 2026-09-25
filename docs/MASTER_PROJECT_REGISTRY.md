# MASTER Project Registry

Canonical working registry for the active project portfolio. Updated 2026-09-25.

## Rule

This repository is the canonical BCO application source. Do not continue work in legacy/duplicate app repositories or old Vercel projects unless explicitly needed for recovery.

## Active portfolio

### BCO — Business Control ONE
- GitHub: https://github.com/lickovci-cpu/Business-Control-ONE-17-MAX-
- Vercel project: https://vercel.com/wemone-5402s-projects/business-control-one
- Production: https://business-control-one.vercel.app
- Current production deployment: dpl_HRKcKjdXd3Rr8xvnyau3PbhkRUqL
- Current production commit: ed883e877c738f6d3a959dd119739fcab227f3f9
- Supabase: https://supabase.com/dashboard/project/vjzzvopwecmwuccdidzq
- Status: VERIFIED production deployment; runtime error scan clean for the last 2h.
- Automation: scheduler compatibility fix merged; actual autonomous run history still NOT VERIFIED because automation_runs=0 and ai_runs=0 at last audit.

### NŘŠM
- GitHub: https://github.com/lickovci-cpu/nrsm-streetwear-current
- Vercel project: https://vercel.com/wemone-5402s-projects/nrsm-streetwear
- Production: https://nrsm-streetwear.vercel.app
- Current production deployment: dpl_66yYoEuRL81isXSYgHL4pniubiDS
- Current production commit: c630ff2662fb4a45767ed0ad549a91006e1bab7a
- Status: VERIFIED deployment and public page. No runtime errors in last 24h.
- Catalog: 32 active products in Supabase and web catalog aligned at last audit.
- Remaining blocker: payments / fulfillment / legal / final commerce flow verification.

### MazliPrint
- Vercel project: https://vercel.com/wemone-5402s-projects/mazliprint-final
- Production: https://mazliprint-final.vercel.app
- Current production deployment: dpl_CVjRqK2a6tLL6cNRrbMjVN5h6Lbm
- Status: VERIFIED public landing page and production deployment.
- Source repo: NOT VERIFIED. Current Vercel deployment metadata does not expose a GitHub repository/commit.
- Current funnel: photo -> style -> preview promise -> WhatsApp handoff.
- Remaining blocker: canonical source code, real upload/preview workflow, fulfillment, payment, legal, end-to-end order flow.

### FVE / Jihočeské střechy a FVE
- BCO organization: fve
- Public website: NOT VERIFIED
- BCO CRM / agents / automation: EXISTS
- Priority: lead acquisition and service funnel, then connect into BCO.

## Known legacy/duplicate projects

Do not use as the primary source:
- merch-generator
- N-M-
- N-M-100-
- nrsm-store
- nrsm-store-final
- NRSM-Streetwear
- NRSM-Streetwear-Store
- NRSMREPLITUPLOADFIXEDzip
- old BCO Vercel projects such as business-control-app-suite, business-control-app-suite-path-test, business-control-cloud, bcc-pathprobe
- mockup-sandbox is disposable preview infrastructure, not the source of truth

## Operating rule

All future work should start from this registry and verify the current GitHub/Vercel/Supabase state before changing code or data.
