import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const edge = readFileSync(new URL("../supabase/functions/bco-command-center/index.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261122021357_bco_revenue_proposals_workspace.sql", import.meta.url), "utf8");

assert.match(app, /BCO_REVENUE_STAGE_URL='https:\/\/pflfbphulvutccvvhrot\.supabase\.co'/);
assert.match(app, /BCO_REVENUE_SESSION_KEY='bco-revenue-staging-session-v1'/);
assert.match(app, /fetch\('\/api\/revenue\?'/);
assert.match(app, /Authorization='Bearer '\+bcoRevenueSession\.access_token/);
assert.match(app, /proposalSignIn/);
assert.match(app, /proposalSignUp/);
assert.match(app, /approve_proposal/);
assert.match(app, /reject_proposal/);
assert.match(html, /section id="proposals"/);
assert.match(edge, /action === "create_workspace"/);
assert.match(edge, /action === "approve_proposal" \|\| action === "reject_proposal"/);
assert.match(edge, /action === "proposals"/);
assert.match(edge, /maybeSingle\(\)/);
assert.match(migration, /create or replace function private\.reject_internal_task_proposal/i);
assert.match(migration, /coalesce\(v_role, ''\) not in \('owner','admin','manager'\)/i);
assert.match(migration, /create or replace function private\.create_bco_revenue_workspace/i);
assert.match(migration, /grant execute on function public\.create_bco_revenue_workspace\(text\) to authenticated/i);
assert.doesNotMatch(migration, /grant execute on function public\.create_bco_revenue_workspace\(text\) to anon/i);

console.log("BCO REVENUE PROPOSAL INBOX STATIC TEST OK");
