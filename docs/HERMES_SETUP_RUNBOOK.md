# Hermes Setup Runbook

Updated: 2026-09-26

## Objective

Set up Hermes as the strategic autonomous layer for the business portfolio while keeping BCO as the structured source of truth and approval/control plane.

## 1. Verify before changing anything

Run the repository PowerShell diagnostic:

tools/hermes-diagnose.ps1

It should produce a local report containing:
- Hermes version;
- active profile and Hermes home;
- provider/model metadata;
- toolsets;
- MCP inventory;
- skills inventory;
- cron inventory;
- gateway state;
- portal state;
- computer-use state.

Do not paste secrets into chat.

## 2. Version baseline

The inspected local installation is Hermes Agent v0.21.5+2583.gf077152 (2026-09-24 build).

The current installation method is a managed git/source checkout under the user's local Hermes directory.

Do not upgrade blindly. First run `hermes update --check`, then `hermes update --plan`. The official updater documents both as preview-only operations; `--check` compares the checkout with its update target and `--plan` inventories profiles/services before a real update. Do not run the real update until the local profile and gateway state are backed up/reviewed.

## 3. Current audit snapshot

Observed from the user's Windows diagnostic on 2026-09-26:
- Windows 10 x86_64, PowerShell 5.1;
- Hermes v0.21.5+2583.gf077152;
- Python 3.14.7 bundled with the source installation;
- active profile: default;
- model: upstage/solar-pro4:free;
- provider: nous;
- toolsets: hermes-cli only;
- MCP servers: 0;
- memory: built-in;
- gateway: running as a manually started process;
- cron: 3 active / 5 total;
- installed skills: 58;
- no provider/tool API keys reported as configured.

This means the current installation is functional but not yet equipped as a business research/execution agent. The largest capability gaps are toolsets and integrations, not core model execution.

Important: current upstream support explicitly lists Windows 10/11 x86_64 as Tier 1, but the precise oldest supported Windows build is not stated in the public docs. Keep the existing OS until a concrete incompatibility appears.

## 4. Windows baseline

Native Windows is supported. Current native Hermes supports CLI/TUI, gateway, cron, browser, MCP, dashboard and auto-start. WSL2 is optional.

For a clean/recovery install, use the official installer rather than copying an old Hermes directory. Do not reinstall while the current source checkout is healthy; preserve the working installation until the profile/tool audit is complete.

## 5. Profiles

Recommended first profile:

hermes profile create business --description "Strategic research, revenue discovery, BCO supervision and opportunity validation."

Do not create multiple profiles until the base profile is known to work.

Every profile has separate configuration, memory, sessions, skills and state. Never run two agent processes against the same Hermes home/profile.

## 6. Core skill installation

Install the BCO operator skill from the public canonical repository:

hermes skills install https://raw.githubusercontent.com/lickovci-cpu/Business-Control-ONE-17-MAX-/main/hermes-skills/bco-operator/SKILL.md

Install the revenue radar skill:

hermes skills install https://raw.githubusercontent.com/lickovci-cpu/Business-Control-ONE-17-MAX-/main/hermes-skills/revenue-radar/SKILL.md

Then verify:

hermes skills list

Skills take effect in new sessions.

## 7. Operating model

Hermes owns:
- research;
- opportunity radar;
- cross-project strategy;
- orchestration;
- learning;
- monitoring;
- draft generation.

BCO owns:
- CRM;
- project state;
- lead records;
- approvals;
- execution queues;
- audit;
- structured agent runtime;
- BCO-native automations.

Supabase remains the business source of truth.

## 8. Initial automation design

Do not duplicate BCO scheduling.

Hermes should use its own cron only for intelligence:
- every 2h: fresh revenue signals;
- daily: deep multi-market opportunity scan;
- daily: BCO health/telemetry review;
- weekly: experiment review and eliminate weak opportunities.

BCO continues to own execution-oriented scheduled work.

## 9. First Hermes research cycle

The first unattended research cycle should:
1. inspect current BCO project state;
2. collect fresh demand evidence;
3. search Czechia + EU + UK + US and at least one additional market;
4. identify service opportunities deliverable remotely from Czechia;
5. separate observed demand from assumptions;
6. produce concrete paid-test ideas;
7. create internal tasks only;
8. keep external messages, ads, spending and production changes approval-gated.

## 10. Current market hypotheses

Fresh 2026 marketplace reports show meaningful demand signals around:
- AI implementation/integration;
- CRM and revenue systems;
- QA and operational cleanup;
- AI-assisted content plus human refinement;
- data cleanup and document conversion;
- AI automation.

Treat these as hypotheses and revalidate them on every fresh scan.

## 11. Stop conditions

Hermes should stop and create a review task when:
- evidence conflicts;
- required permissions are missing;
- a task would spend money;
- an external message would be sent;
- a production secret/auth/RLS/billing change is needed;
- a destructive operation is proposed;
- expected economics cannot be established.

## 12. Success definition

Hermes is not successful because it generates many ideas.

Success means:
- opportunities become validated paid tests;
- validated tests become real revenue;
- repeated work becomes automated;
- weak experiments are killed quickly;
- BCO stays consistent and auditable;
- operating cost remains controlled.
