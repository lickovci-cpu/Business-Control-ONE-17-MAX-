import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../supabase/functions/automation-executor/index.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20261121143116_bco_automation_claims.sql", import.meta.url), "utf8");

assert.match(source, /\.eq\("id", runId\)\.eq\("automation_id", automationId\)\.eq\("organization_id", organizationId\)/);
assert.match(source, /\.eq\("id", automationId\)\.eq\("organization_id", organizationId\)/);
assert.match(source, /\.eq\("organization_id", organizationId\)\.eq\("slug", slug\)/);
assert.match(source, /allowedActions\(foundAgent\.allowed_actions\)/);
assert.match(source, /ai_approvals/);
assert.match(source, /PROVIDER_SECRET_MISSING/);
assert.match(source, /PROVIDER_ADAPTER_NOT_IMPLEMENTED/);
assert.match(source, /EXTERNAL_ACTIONS_DISABLED_IN_INITIAL_RELEASE/);
assert.match(source, /p_automation_id: run\.automationId/);
assert.match(source, /p_organization_id: run\.organizationId/);
assert.match(source, /p_status: "failed"/);
assert.match(source, /BACKOFF_MINUTES = \[5, 15, 60\]/);
assert.match(source, /record_bco_executor_audit/);
assert.match(source, /finish_bco_automation_run/);
assert.match(source, /RUN_LEASE_EXPIRED/);
assert.match(source, /finalized: true/);
assert.ok(source.indexOf('record_bco_executor_audit') < source.indexOf('finish_bco_automation_run'),
  "Audit must be attempted before finish so a completion race does not discard the event");
assert.doesNotMatch(source, /fetch\(.*AI_PROVIDER_URL/s, "No AI provider request is allowed in fail-closed release");

assert.match(migration, /create unique index if not exists ai_runs_automation_run_uidx/i);
assert.match(migration, /input->>'automation_run_id'/i);
assert.match(migration, /p_organization_id uuid/i);
assert.match(migration, /where id = p_run_id\s+and automation_id = p_automation_id\s+and organization_id = p_organization_id/i);
assert.match(migration, /record_bco_executor_audit/i);
console.log("AUTOMATION EXECUTOR FAIL-CLOSED STATIC TEST OK");
