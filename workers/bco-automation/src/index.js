const BACKOFF_MINUTES = [5, 15, 60];
const MAX_BATCH = 20;

function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
function required(env, key) {
  const value = env[key];
  if (!value) throw new Error("MISSING_" + key);
  return value;
}
export function backoffMinutes(attempt) {
  return BACKOFF_MINUTES[Math.min(Math.max(Number(attempt || 1) - 1, 0), BACKOFF_MINUTES.length - 1)];
}
async function supabaseRequest(env, path, options) {
  const base = required(env, "SUPABASE_URL").replace(/\/+$/, "");
  const key = required(env, "SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(base + "/rest/v1/" + path, {
    ...options,
    headers: {
      apikey: key,
      authorization: "Bearer " + key,
      "content-type": "application/json",
      ...(options && options.headers ? options.headers : {})
    }
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) throw new Error("SUPABASE_HTTP_" + response.status + ":" + String(data && (data.message || data.error) || "request_failed").slice(0, 300));
  return data;
}
function executorUrl(env) {
  const raw = required(env, "AUTOMATION_EXECUTOR_URL");
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("EXECUTOR_URL_MUST_BE_HTTPS");
  return url.toString();
}
export async function runTick(env, scheduledAt) {
  const executor = executorUrl(env);
  const token = required(env, "AUTOMATION_EXECUTOR_TOKEN");
  const slot = new Date(Math.floor(new Date(scheduledAt || Date.now()).getTime() / 300000) * 300000).toISOString();
  const claimed = await supabaseRequest(env, "rpc/claim_bco_automation_runs", {
    method: "POST",
    body: JSON.stringify({ p_slot: slot, p_limit: MAX_BATCH })
  });
  const results = [];
  for (const item of Array.isArray(claimed) ? claimed : []) {
    try {
      const response = await fetch(executor, {
        method: "POST",
        headers: { authorization: "Bearer " + token, "content-type": "application/json" },
        body: JSON.stringify({
          automation_id: item.automation_id,
          organization_id: item.organization_id,
          run_id: item.run_id,
          action_config: item.action_config,
          trigger_config: item.trigger_config,
          schedule_slot: slot
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok !== true) throw new Error("EXECUTOR_HTTP_" + response.status + ":" + String(body.error || "execution_failed").slice(0, 250));
      await supabaseRequest(env, "rpc/finish_bco_automation_run", {
        method: "POST",
        body: JSON.stringify({
          p_run_id: item.run_id,
          p_automation_id: item.automation_id,
          p_organization_id: item.organization_id,
          p_success: true,
          p_output: body,
          p_error: null,
          p_retry_at: null
        })
      });
      results.push({ run_id: item.run_id, status: "completed" });
    } catch (error) {
      const attempt = Number(item.attempt_count || 1);
      const retryAt = new Date(Date.now() + backoffMinutes(attempt) * 60000).toISOString();
      const message = String(error && error.message || "EXECUTION_FAILED").slice(0, 1000);
      await supabaseRequest(env, "rpc/finish_bco_automation_run", {
        method: "POST",
        body: JSON.stringify({
          p_run_id: item.run_id,
          p_automation_id: item.automation_id,
          p_organization_id: item.organization_id,
          p_success: false,
          p_output: null,
          p_error: message,
          p_retry_at: retryAt
        })
      });
      results.push({ run_id: item.run_id, status: "failed", retry_at: retryAt });
    }
  }
  return { ok: true, slot, claimed: Array.isArray(claimed) ? claimed.length : 0, results };
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") return json({ ok: true, service: "bco-automation-preview", mode: "scheduled-runner" });
    return json({ ok: false, error: "NOT_FOUND" }, 404);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runTick(env, new Date(event.scheduledTime)).then((result) => console.log(JSON.stringify(result))).catch((error) => console.error(JSON.stringify({ event: "automation_tick_failed", message: String(error && error.message || error).slice(0, 500) }))));
  }
};
