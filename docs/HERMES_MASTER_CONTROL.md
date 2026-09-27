# HERMES MASTER CONTROL

Updated: 2026-09-27

## Purpose

Hermes is the strategic revenue and opportunity layer. Business Control ONE (BCO) is the structured operating system and approval/control plane.

The system exists to turn:

**signal → lead → contact → offer → job/order → payment → repeatability**

Do not build duplicate CRM, duplicate project registry, or duplicate source-of-truth data in Hermes.

## Canonical stack

- Hermes: research, opportunity discovery, synthesis, orchestration, monitoring, learning.
- BCO: CRM, leads, opportunities, tasks, projects, approvals, content operations, audit and agent runtime.
- Supabase: business source of truth.
- GitHub: canonical code and operational documentation.
- Vercel: production runtime and deployment.
- Outlook: direct business communication.
- Metricool: NŘŠM social distribution and analytics.
- Make: optional external workflow integration.
- Browser / web: demand research and verification.
- Upwork: remote service acquisition.
- Local n8n demo: sales proof for automation services.

## Canonical portfolio

| Project | Role | Current public surface | State |
|---|---|---|---|
| BCO | command/control | https://business-control-one.vercel.app | production |
| NŘŠM | merch + B2B | https://nrsm-streetwear.vercel.app | production |
| MazliPrint | pet-photo commerce test | https://mazliprint-final.vercel.app | landing/funnel |
| FVE | installation/subcontracting | public website not verified | lead acquisition priority |

## Revenue priority

1. FVE subcontracting / installation.
2. NŘŠM warm and high-fit B2B prospects.
3. Remote n8n / AI automation services.
4. Local roof/facade/gutter/PV-cleaning demand.
5. New opportunity classes only when current buyer evidence exists.

Infrastructure is subordinate to revenue. Do not add features merely because they are technically interesting.

## BCO operating loop

1. New signal or lead enters.
2. BCO stores the structured record.
3. AI/operator qualifies it.
4. A next action is created.
5. External communication remains approval-gated unless explicitly authorized.
6. Response / job / order is written back to the same record.
7. Follow-up is scheduled.
8. Outcome is measured.
9. Hermes learns reusable patterns from the result.

## Hermes operating loop

### Fast loop
Research new buyer demand and changes in current opportunities.

### Validation loop
For each candidate record:
- buyer;
- problem;
- exact deliverable;
- current evidence;
- evidence date/source;
- startup cost;
- delivery time;
- required permissions;
- competition/commoditization risk;
- automation leverage;
- smallest paid test;
- kill condition.

### Portfolio loop
Compare opportunities by independent dimensions:
- speed to first sale;
- startup cost;
- demand evidence;
- delivery fit;
- repeatability;
- automation leverage.

Do not collapse these dimensions into a fake overall score.

### Learning loop
Keep durable facts and reusable procedures. Use session history for detailed history. Create a new skill only when a process is genuinely reusable.

## Lead acquisition engine

Hermes should continuously search:
- freelance marketplaces;
- subcontracting/job boards;
- direct SMB requests;
- agency overflow;
- public procurement;
- creator/artist/event ecosystems;
- ecommerce enablement;
- local services;
- emerging software ecosystems.

For every lead:
- check whether it already exists;
- check previous contact history;
- suppress known bounces/spam/problem addresses;
- personalize using only verified facts;
- choose the smallest useful next step;
- create/update the BCO record.

Never mass-send identical cold messages.

## Outbound ladder

Use the least risky effective channel first:

1. Reply to an existing warm thread.
2. Personalized direct email to a verified buyer contact.
3. Website/contact form where appropriate.
4. Social DM only when the platform/account context supports it.
5. Marketplace proposal when the account has the required Connects/permissions.

Every outbound attempt should have:
- one clear reason for contacting this buyer;
- one concrete offer;
- one low-friction CTA;
- no invented case studies, prices, certifications or results.

## Social distribution engine

Current Metricool NŘŠM brand:
- Brand ID: 7108893
- Timezone: Europe/Prague
- Facebook Page connected
- Instagram: @nrsm.merch
- TikTok connected

Current scheduled queue:
- Instagram: existing posts through 2026-10-04.
- Facebook: existing posts through 2026-10-03.
- TikTok: new cross-platform queue added for 2026-10-02, 2026-10-05 and 2026-10-07.

Content rule:
**one source idea → multiple native formats**, not copy-paste flooding.

Repurpose:
- post;
- short video/reel;
- carousel;
- stories;
- B2B variant;
- search/SEO page when useful.

Measure:
- reach;
- interactions;
- saves/shares;
- link clicks;
- profile actions;
- leads;
- inquiries;
- sales.

Do not optimize from vanity reach alone.

## Social channel expansion

When accounts/permissions are available, evaluate:
- Instagram;
- Facebook;
- TikTok;
- YouTube Shorts;
- LinkedIn;
- Threads;
- Bluesky;
- Pinterest;
- Google Business Profile;
- Google Search / Images;
- Bing / IndexNow;
- selective communities.

Only publish to a channel that is actually connected and technically verified. Prepare content for disconnected channels; do not pretend it was published.

## Current BCO content engine

The production BCO contains:
- command center;
- cash sprint;
- control room;
- content worker;
- content engine;
- campaign factory;
- reels studio;
- autopilot;
- settings/recovery;
- approval-aware Meta publishing.

The UI is already broad enough for current operations. Do not rebuild it until a concrete blocker is demonstrated.

## Current data inventory

As of 2026-09-27:
- 3 organizations;
- 2 CRM leads;
- 4 opportunities;
- 8 open/in-progress/blocked tasks;
- 69 NŘŠM prospects;
- 88 NŘŠM outreach drafts;
- 32 NŘŠM products;
- 0 NŘŠM orders;
- 31 content_items;
- 36 AI agents;
- 0 ai_runs recorded;
- 0 automation_runs recorded at the audit moment.

Interpret zero counts carefully: zero recorded telemetry does not prove zero business activity elsewhere.

## Automation architecture

BCO Vercel cron includes:
- /api/cron every 5 min;
- /api/automation-tick every 5 min;
- /api/merch-cron every 6 h.

Automation tick reads scheduled Supabase automations, runs configured BCO agents and writes next actions into tasks.

Current active Supabase automations:
- FVE CEO planner, every 6 h;
- NŘŠM CEO planner, every 6 h;
- Email Intake → AI classification, every 5 min;
- Web Health Audit, every 24 h.

At audit time, all four had last_run_at = null and automation_runs = 0.

## Important technical finding

Production logs showed /api/automation-tick returning HTTP 409 every 5 minutes.

The code maps a failed KV lock acquisition to HTTP 409. The KV helper also returns false when KV is not configured. This makes a missing KV connection indistinguishable from a real lock collision.

Operational consequence:
- cron is firing;
- the endpoint is reachable;
- the automation work itself is not proven to be executing.

The next technical fix should make this state explicit and keep the automation tick functional without making Hermes depend on a second data store for core business execution.

## Current external blockers

- Upwork account has 0 Connects, so proposals cannot currently be submitted.
- Outlook FVE account has demonstrated spam filtering for at least two recipients; do not blindly resend identical content.
- MazliPrint has a public funnel but the end-to-end live commerce/fulfillment flow is not yet verified.
- FVE public website is not verified.
- Hermes local runtime is user-managed Windows software and cannot be changed from ChatGPT without a local action.

## User control model

The simplest daily interface is BCO, not Hermes CLI.

### Daily
Open:
https://business-control-one.vercel.app

Use:
- project switcher;
- command field;
- Today / Money / Control;
- Worker / Content / Reels;
- Autopilot;
- Settings.

### User should usually only need to do three things
1. approve a high-impact external action;
2. supply a missing credential/permission when a hard blocker exists;
3. handle physical work that cannot be delegated.

Everything else should be prepared automatically.

## Approval gates

Require explicit approval for:
- spending money;
- buying credits/Connects;
- paid advertising;
- sending external business messages when not already explicitly authorized;
- production secrets;
- authentication/RLS/billing changes;
- destructive production changes;
- contractual or legal commitments.

A broad user request can authorize an action category for the current task. Do not silently expand that authorization to unrelated high-impact actions.

## Anti-duplication rule

Before creating anything:
1. search BCO;
2. search the relevant mailbox;
3. inspect current scheduled content;
4. inspect GitHub canonical source;
5. verify whether a legacy project already contains the same capability.

Prefer updating an existing record, draft or asset.

## Decision rule for new work

Do the work only when at least one is true:
- it can produce a sale;
- it prevents loss of an existing opportunity;
- it removes a current execution blocker;
- it makes a proven repeated process cheaper/faster.

Otherwise defer it.

## Success criteria

Hermes is successful when:
- buyer demand is found early;
- qualified leads enter BCO without duplicates;
- outbound is personalized and measurable;
- social content reaches relevant audiences;
- inquiries convert into paid tests;
- repeated work becomes automated;
- weak experiments are killed quickly;
- business data remains auditable;
- operating cost remains low.
