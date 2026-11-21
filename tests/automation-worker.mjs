import assert from "node:assert/strict";
import { backoffMinutes, runTick } from "../workers/bco-automation/src/index.js";

assert.equal(backoffMinutes(1), 5);
assert.equal(backoffMinutes(2), 15);
assert.equal(backoffMinutes(3), 60);
assert.equal(backoffMinutes(4), 60);

const realFetch = global.fetch;
const calls = [];
const executorUrl = "https://pflfbphulvutccvvhrot.supabase.co/functions/v1/automation-executor";
let executorFails = false;
let claimCount = 20;

function env(overrides = {}) {
  return {
    SUPABASE_URL: "https://pflfbphulvutccvvhrot.supabase.co",
    SUPABASE_PROJECT_REF: "pflfbphulvutccvvhrot",
    BCO_PRODUCTION_PROJECT_REF: "vjzzvopwecmwuccdidzq",
    SUPABASE_SERVICE_ROLE_KEY: "staging-test-only",
    AUTOMATION_EXECUTOR_URL: executorUrl,
    AUTOMATION_EXECUTOR_TOKEN: "staging-token-test-only",
    ...overrides
  };
}
global.fetch = async (url, options = {}) => {
  const target = String(url);
  calls.push({ url: target, method: options.method || "GET", body: options.body, headers: options.headers || {} });
  if (target.endsWith("/rpc/claim_bco_automation_runs")) {
    return new Response(JSON.stringify(Array.from({ length: claimCount }, (_, i) => ({
      run_id: `run-${i + 1}`,
      automation_id: `automation-${i + 1}`,
      organization_id: "staging-org",
      action_config: { agent: "ceo", action: "autonomous_tick" },
      trigger_config: {},
      attempt_count: 1
    }))), { status: 200 });
  }
  if (target === executorUrl) {
    return executorFails
      ? new Response(JSON.stringify({ ok: false, error: "TEST_FAILURE" }), { status: 500 })
      : new Response(JSON.stringify({
          ok: true, finalized: true, status: "failed",
          reason: "PROVIDER_SECRET_MISSING", audit_written: true
        }), { status: 200 });
  }
  if (target.includes("/rest/v1/automation_runs?select=")) {
    return new Response(JSON.stringify([{ status: "running", lease_expires_at: new Date(Date.now() + 60_000).toISOString() }]), { status: 200 });
  }
  if (target.includes("/rest/v1/ai_agents?select=")) {
    return new Response(JSON.stringify([{ id: "agent-1", slug: "ceo" }]), { status: 200 });
  }
  if (target.endsWith("/rpc/record_bco_executor_audit") || target.endsWith("/rpc/finish_bco_automation_run")) {
    return new Response("null", { status: 200 });
  }
  throw new Error("Unexpected mocked request: " + target);
};

try {
  const missing = env();
  delete missing.AUTOMATION_EXECUTOR_URL;
  await assert.rejects(() => runTick(missing, new Date("2026-11-21T10:00:00Z")), /MISSING_AUTOMATION_EXECUTOR_URL/);

  await assert.rejects(() => runTick(env({ AUTOMATION_EXECUTOR_URL: "http://pflfbphulvutccvvhrot.supabase.co/functions/v1/automation-executor" }), new Date()), /EXECUTOR_URL_MUST_BE_HTTPS/);
  await assert.rejects(() => runTick(env({ SUPABASE_PROJECT_REF: "vjzzvopwecmwuccdidzq" }), new Date()), /STAGING_PROJECT_REF_MISMATCH/);

  calls.length = 0;
  claimCount = 20;
  const result = await runTick(env(), new Date("2026-11-21T10:02:00Z"));
  assert.equal(result.claimed, 20, "Worker should accept the atomic claim batch");
  assert.equal(result.results.length, 20, "Worker should process the full concurrent batch");
  assert.ok(result.results.every((x) => x.status === "failed" && x.reason === "PROVIDER_SECRET_MISSING"));
  assert.equal(calls.filter((x) => x.url === executorUrl).length, 20, "20 executor calls must run");
  const claim = calls.find((x) => x.url.endsWith("/rpc/claim_bco_automation_runs"));
  assert.match(claim.body, /"p_limit":20/);
  assert.equal(calls.some((x) => x.url.endsWith("/rpc/finish_bco_automation_run")), false,
    "Worker must not double-finish a run finalized by executor");

  calls.length = 0;
  claimCount = 1;
  executorFails = true;
  const failed = await runTick(env(), new Date("2026-11-21T10:07:00Z"));
  assert.equal(failed.results[0].status, "failed");
  assert.equal(failed.results[0].fallback, "finished_failed");
  const auditCall = calls.find((x) => x.url.endsWith("/rpc/record_bco_executor_audit"));
  const finishCall = calls.find((x) => x.url.endsWith("/rpc/finish_bco_automation_run"));
  assert.ok(auditCall, "Worker fallback must attempt ai_runs audit");
  assert.ok(finishCall, "Worker fallback must finish an active lease");
  assert.match(auditCall.body, /"p_organization_id":"staging-org"/);
  assert.match(finishCall.body, /"p_organization_id":"staging-org"/);
  assert.match(finishCall.body, /"p_success":false/);
  assert.match(finishCall.body, /"p_retry_at":/);
} finally {
  global.fetch = realFetch;
}
console.log("AUTOMATION WORKER OK — staging pin, 20-way dispatch, executor-owned finish, retry fallback and tenant-scoped audit");
