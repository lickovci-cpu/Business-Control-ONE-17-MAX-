import assert from "node:assert/strict";
import { backoffMinutes, runTick } from "../workers/bco-automation/src/index.js";
assert.equal(backoffMinutes(1), 5);
assert.equal(backoffMinutes(2), 15);
assert.equal(backoffMinutes(3), 60);
assert.equal(backoffMinutes(4), 60);
const realFetch = global.fetch;
let calls = [];
let executorFails = false;
global.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), method: options.method || "GET", body: options.body });
  if (String(url).endsWith("/rpc/claim_bco_automation_runs")) {
    return new Response(JSON.stringify([{ run_id: "run-1", automation_id: "auto-1", organization_id: "org-1", action_config: { action: "autonomous_tick" }, trigger_config: {}, attempt_count: 1 }]), { status: 200 });
  }
  if (String(url) === "https://executor.example/run") {
    return executorFails
      ? new Response(JSON.stringify({ ok: false, error: "TEST_FAILURE" }), { status: 500 })
      : new Response(JSON.stringify({ ok: true, mode: "test" }), { status: 200 });
  }
  return new Response("null", { status: 200 });
};
try {
  await assert.rejects(() => runTick({ SUPABASE_URL: "https://db.example", SUPABASE_SERVICE_ROLE_KEY: "test" }, new Date("2026-11-21T10:00:00Z")), /MISSING_AUTOMATION_EXECUTOR_URL/);
  await assert.rejects(() => runTick({
    SUPABASE_URL: "https://db.example",
    SUPABASE_SERVICE_ROLE_KEY: "test",
    AUTOMATION_EXECUTOR_URL: "http://executor.example/run",
    AUTOMATION_EXECUTOR_TOKEN: "test"
  }, new Date("2026-11-21T10:00:00Z")), /EXECUTOR_URL_MUST_BE_HTTPS/);
  const result = await runTick({
    SUPABASE_URL: "https://db.example",
    SUPABASE_SERVICE_ROLE_KEY: "test",
    AUTOMATION_EXECUTOR_URL: "https://executor.example/run",
    AUTOMATION_EXECUTOR_TOKEN: "test"
  }, new Date("2026-11-21T10:02:00Z"));
  assert.equal(result.claimed, 1);
  assert.equal(result.results[0].status, "completed");
  assert.equal(calls.filter((x) => x.url.endsWith("/rpc/finish_bco_automation_run")).length, 1);
  assert.equal(calls.some((x) => x.method === "PATCH"), false);
  executorFails = true;
  calls = [];
  const failed = await runTick({
    SUPABASE_URL: "https://db.example",
    SUPABASE_SERVICE_ROLE_KEY: "test",
    AUTOMATION_EXECUTOR_URL: "https://executor.example/run",
    AUTOMATION_EXECUTOR_TOKEN: "test"
  }, new Date("2026-11-21T10:07:00Z"));
  assert.equal(failed.results[0].status, "failed");
  const finishCall = calls.find((x) => x.url.endsWith("/rpc/finish_bco_automation_run"));
  assert.ok(finishCall);
  assert.match(finishCall.body, /"p_success":false/);
  assert.match(finishCall.body, /"p_retry_at":/);
  assert.ok(calls.some((x) => x.url.endsWith("/rpc/claim_bco_automation_runs")));
} finally {
  global.fetch = realFetch;
}
console.log("AUTOMATION WORKER OK — executor gate, claim RPC, completion and read-only test doubles");
