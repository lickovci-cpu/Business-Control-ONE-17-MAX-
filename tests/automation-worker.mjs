import assert from "node:assert/strict";
import { runTick } from "../workers/bco-automation/src/index.js";
const realFetch = global.fetch;
let calls = [];
global.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), method: options.method || "GET", body: options.body });
  if (String(url).endsWith("/rpc/claim_bco_automation_runs")) {
    return new Response(JSON.stringify([{ run_id: "run-1", automation_id: "auto-1", organization_id: "org-1", action_config: { action: "autonomous_tick" }, trigger_config: {}, attempt_count: 1 }]), { status: 200 });
  }
  if (String(url) === "https://executor.example/run") return new Response(JSON.stringify({ ok: true, mode: "test" }), { status: 200 });
  return new Response("{}", { status: 200 });
};
try {
  await assert.rejects(() => runTick({ SUPABASE_URL: "https://db.example", SUPABASE_SERVICE_ROLE_KEY: "test" }, new Date("2026-11-21T10:00:00Z")), /MISSING_AUTOMATION_EXECUTOR_URL/);
  const result = await runTick({
    SUPABASE_URL: "https://db.example",
    SUPABASE_SERVICE_ROLE_KEY: "test",
    AUTOMATION_EXECUTOR_URL: "https://executor.example/run",
    AUTOMATION_EXECUTOR_TOKEN: "test"
  }, new Date("2026-11-21T10:02:00Z"));
  assert.equal(result.claimed, 1);
  assert.equal(result.results[0].status, "completed");
  assert.equal(calls.filter((x) => x.method === "PATCH").length, 2);
  assert.ok(calls.some((x) => x.url.endsWith("/rpc/claim_bco_automation_runs")));
} finally {
  global.fetch = realFetch;
}
console.log("AUTOMATION WORKER OK — executor gate, claim RPC, completion and read-only test doubles");
