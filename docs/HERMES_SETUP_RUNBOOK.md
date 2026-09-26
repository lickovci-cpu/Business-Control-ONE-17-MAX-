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

The current official Hermes release observed on 2026-09-26 is v0.21.3 (2026.9.14).

Do not upgrade blindly. First compare the installed version and current profile state.

## 3. Windows baseline

Native Windows is supported. Current native Hermes supports CLI/TUI, gateway, cron, browser, MCP, dashboard and auto-start. WSL2 is optional.

For a clean/recovery install, use the official installer rather than copying an old Hermes directory.

## 4. Profiles

Recommended first profile:

hermes profile create business --description "Strategic research, revenue discovery, BCO supervision and opportunity validation."

Do not create multiple profiles until the base profile is known to work.

Every profile has separate configuration, memory, sessions, skills and state. Never run two agent processes against the same Hermes home/profile.

## 5. Core skill installation

Install the BCO operator skill from the public canonical repository:

hermes skills install https://raw.githubusercontent.com/lickovci-cpu/Business-Control-ONE-17-MAX-/main/hermes-skills/bco-operator/SKILL.md

Install the revenue radar skill:

hermes skills install https://raw.githubusercontent.com/lickovci-cpu/Business-Control-ONE-17-MAX-/main/hermes-skills/revenue-radar/SKILL.md

Then verify:

hermes skills list

Skills take effect in new sessions.

## 6. Operating model

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

## 7. Initial automation design

Do not duplicate BCO scheduling.

Hermes should use its own cron only for intelligence:
- every 2h: fresh revenue signals;
- daily: deep multi-market opportunity scan;
- daily: BCO health/telemetry review;
- weekly: experiment review and eliminate weak opportunities.

BCO continues to own execution-oriented scheduled work.

## 8. First Hermes research cycle

The first unattended research cycle should:
1. inspect current BCO project state;
2. collect fresh demand evidence;
3. search Czechia + EU + UK + US and at least one additional market;
4. identify service opportunities deliverable remotely from Czechia;
5. separate observed demand from assumptions;
6. produce concrete paid-test ideas;
7. create internal tasks only;
8. keep external messages, ads, spending and production changes approval-gated.

## 9. Current market hypotheses

Fresh 2026 marketplace reports show meaningful demand signals around:
- AI implementation/integration;
- CRM and revenue systems;
- QA and operational cleanup;
- AI-assisted content plus human refinement;
- data cleanup and document conversion;
- AI automation.

Treat these as hypotheses and revalidate them on every fresh scan.

## 10. Stop conditions

Hermes should stop and create a review task when:
- evidence conflicts;
- required permissions are missing;
- a task would spend money;
- an external message would be sent;
- a production secret/auth/RLS/billing change is needed;
- a destructive operation is proposed;
- expected economics cannot be established.

## 11. Success definition

Hermes is not successful because it generates many ideas.

Success means:
- opportunities become validated paid tests;
- validated tests become real revenue;
- repeated work becomes automated;
- weak experiments are killed quickly;
- BCO stays consistent and auditable;
- operating cost remains controlled.
