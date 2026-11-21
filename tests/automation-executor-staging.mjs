import assert from "node:assert/strict";

const base = process.env.BCO_STAGING_SUPABASE_URL;
const key = process.env.BCO_STAGING_SERVICE_ROLE_KEY;
const stagingRef = process.env.BCO_STAGING_PROJECT_REF;
const productionRef = process.env.BCO_PRODUCTION_PROJECT_REF;
const organizationId = process.env.BCO_STAGING_ORGANIZATION_ID;
for (const [name, value] of Object.entries({ BCO_STAGING_SUPABASE_URL: base, BCO_STAGING_SERVICE_ROLE_KEY: key, BCO_STAGING_PROJECT_REF: stagingRef, BCO_PRODUCTION_PROJECT_REF: productionRef, BCO_STAGING_ORGANIZATION_ID: organizationId })) {
  if (!value) throw new Error(`Missing required staging-only variable: ${name}`);
}
const hostRef = new URL(base).hostname.split(".")[0];
assert.equal(hostRef, stagingRef, "URL project ref must match explicit staging ref");
assert.notEqual(stagingRef, productionRef, "Refusing to run against production project");
assert.match(organizationId, /^[0-9a-f-]{36}$/i, "A staging organization UUID is required");

const headers = { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" };
async function api(path, options = {}) {
  const response = await fetch(`${base.replace(/\/$/, "")}/rest/v1/${path}`, { ...options, headers: { ...headers, ...(options.headers ?? {}) } });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) throw new Error(`${options.method ?? "GET"} ${path}: HTTP ${response.status} ${JSON.stringify(data)}`);
  return data;
}
async function rpc(name, args) {
  return api(`rpc/${name}`, { method: "POST", body: JSON.stringify(args) });
}
const randomId = () => crypto.randomUUID();
const automationId = randomId();
const slot1 = new Date(Date.now() - 60_000).toISOString();
const slot2 = new Date(Date.parse(slot1) + 120_000).toISOString();
let createdRunIds = [];
try {
  const [automation] = await api("automations?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id: automationId,
      organization_id: organizationId,
      name: "STAGING ONLY — executor concurrency test",
      active: true,
      trigger_type: "scheduled",
      trigger_config: { interval_hours: 1, timezone: "UTC" },
      action_config: { agent: "ceo", action: "autonomous_tick", external_actions_require_approval: true }
    })
  });
  assert.equal(automation.id, automationId);

  const claims = await Promise.all([
    rpc("claim_bco_automation_runs", { p_slot: slot1, p_limit: 1 }),
    rpc("claim_bco_automation_runs", { p_slot: slot1, p_limit: 1 })
  ]);
  const claimed = claims.flat();
  assert.equal(claimed.length, 1, "Two concurrent claimers must produce exactly one claim");
  const first = claimed[0];
  assert.equal(first.automation_id, automationId);
  assert.equal(first.organization_id, organizationId);
  createdRunIds.push(first.run_id);

  // Same automation + same slot must not create another automation_runs row.
  await api(`automations?id=eq.${automationId}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ lease_expires_at: null })
  });
  const repeated = await rpc("claim_bco_automation_runs", { p_slot: slot1, p_limit: 1 });
  assert.equal(repeated.length, 0, "Repeated slot must be idempotent");
  let runs = await api(`automation_runs?select=id,status,lease_expires_at&automation_id=eq.${automationId}`);
  assert.equal(runs.length, 1, "Exactly one row for the repeated slot");

  // An expired lease must fail the stale run and allow a fresh slot to be claimed.
  await api(`automation_runs?id=eq.${first.run_id}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ lease_expires_at: new Date(Date.now() - 10_000).toISOString() })
  });
  await api(`automations?id=eq.${automationId}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ lease_expires_at: null })
  });
  const afterExpiry = await rpc("claim_bco_automation_runs", { p_slot: slot2, p_limit: 1 });
  assert.equal(afterExpiry.length, 1, "Expired lease should be reclaimed in a new slot");
  const second = afterExpiry[0];
  createdRunIds.push(second.run_id);
  runs = await api(`automation_runs?select=id,status,lease_expires_at&automation_id=eq.${automationId}`);
  const stale = runs.find((x) => x.id === first.run_id);
  assert.equal(stale.status, "failed", "Expired run must be failed before reclaim");
  assert.equal(stale.lease_expires_at, null, "Expired lease must be cleared");

  // A foreign organization cannot finish this run.
  const wrongTenant = await fetch(`${base.replace(/\/$/, "")}/rest/v1/rpc/finish_bco_automation_run`, {
    method: "POST", headers, body: JSON.stringify({
      p_run_id: second.run_id, p_automation_id: automationId, p_organization_id: randomId(),
      p_success: true, p_output: { test: true }, p_error: null, p_retry_at: null
    })
  });
  assert.equal(wrongTenant.ok, false, "Wrong organization must not finish a run");

  // A failure with a future retry_at must not be claimed immediately.
  const retryAt = new Date(Date.now() + 5 * 60_000).toISOString();
  await rpc("finish_bco_automation_run", {
    p_run_id: second.run_id, p_automation_id: automationId, p_organization_id: organizationId,
    p_success: false, p_output: {}, p_error: "STAGING_RETRY_TEST", p_retry_at: retryAt
  });
  const earlyRetry = await rpc("claim_bco_automation_runs", { p_slot: new Date(Date.now() + 60_000).toISOString(), p_limit: 1 });
  assert.equal(earlyRetry.length, 0, "next_retry_at must prevent an early retry");

  console.log("STAGING AUTOMATION TESTS PASSED: concurrency, same-slot idempotency, lease expiry, org-scoped finish, retry gate");
} finally {
  await api(`automation_runs?automation_id=eq.${automationId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {});
  await api(`automations?id=eq.${automationId}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }).catch(() => {});
}
