const BACKOFF_MINUTES = [5, 15, 60];
const MAX_BATCH = 20;
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://pflfbphulvutccvvhrot.supabase.co; media-src 'self' blob: https:; manifest-src 'self'; worker-src 'self'; form-action 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'";
const SECURITY = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store",
  "Content-Security-Policy": CSP
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...SECURITY, "Content-Type": "application/json; charset=utf-8" } });
}
function required(env, key) {
  const value = env[key];
  if (!value) throw new Error("MISSING_" + key);
  return value;
}
function stagingOrigin(env) {
  const ref = required(env, "SUPABASE_PROJECT_REF");
  const productionRef = required(env, "BCO_PRODUCTION_PROJECT_REF");
  const url = new URL(required(env, "SUPABASE_URL"));
  if (ref === productionRef || url.protocol !== "https:" || url.hostname !== ref + ".supabase.co" || url.username || url.password) {
    throw new Error("STAGING_PROJECT_REF_MISMATCH");
  }
  return url.origin;
}
function bearer(request) {
  const value = request.headers.get("Authorization") || "";
  if (!/^Bearer [A-Za-z0-9._~-]{20,8192}$/.test(value)) return "";
  return value.slice(7);
}
async function authUser(env, token) {
  const base = stagingOrigin(env);
  const key = required(env, "SUPABASE_PUBLISHABLE_KEY");
  const response = await fetch(base + "/auth/v1/user", {
    headers: { apikey: key, authorization: "Bearer " + token },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return user && typeof user.id === "string" ? user : null;
}
async function sessionRoute(request, env) {
  if (request.method !== "GET") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  const token = bearer(request);
  if (!token) return json({ authenticated: false, error: "AUTH_REQUIRED" }, 401);
  try {
    const user = await authUser(env, token);
    if (!user) return json({ authenticated: false, error: "AUTH_INVALID" }, 401);
    return json({ authenticated: true, user: { id: user.id } });
  } catch (error) {
    return json({ authenticated: false, error: String(error && error.message || "AUTH_UNAVAILABLE").slice(0, 100) }, 503);
  }
}
const REVENUE_ACTIONS = new Map([
  ["health", ["GET"]], ["proposals", ["GET"]], ["dashboard", ["GET"]],
  ["search", ["GET"]], ["analyze", ["GET"]], ["summary", ["GET"]],
  ["create_workspace", ["POST"]], ["approve_proposal", ["POST"]], ["reject_proposal", ["POST"]]
]);
async function revenueRoute(request, env, url) {
  const action = url.searchParams.get("action") || "health";
  const methods = REVENUE_ACTIONS.get(action);
  if (!methods) return json({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  if (!methods.includes(request.method)) return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  const token = bearer(request);
  if (!token) return json({ ok: false, error: "AUTH_REQUIRED" }, 401);
  let base;
  try { base = stagingOrigin(env); } catch (error) {
    return json({ ok: false, error: String(error && error.message || "STAGING_CONFIGURATION_INVALID") }, 503);
  }
  let key;
  try { key = required(env, "SUPABASE_PUBLISHABLE_KEY"); } catch (error) {
    return json({ ok: false, error: String(error && error.message || "STAGING_KEY_NOT_CONFIGURED") }, 503);
  }
  const query = new URLSearchParams({ action });
  for (const name of ["organization_id", "q"]) {
    const value = url.searchParams.get(name);
    if (value) query.set(name, value.slice(0, 200));
  }
  let body;
  if (request.method === "POST") {
    const raw = await request.clone().text();
    if (raw.length > 16384) return json({ ok: false, error: "REQUEST_TOO_LARGE" }, 413);
    try { JSON.parse(raw || "{}"); } catch { return json({ ok: false, error: "INVALID_JSON" }, 400); }
    body = raw || "{}";
  }
  try {
    const upstream = await fetch(base + "/functions/v1/bco-command-center?" + query.toString(), {
      method: request.method,
      headers: {
        apikey: key,
        authorization: "Bearer " + token,
        "content-type": "application/json",
        "cache-control": "no-store"
      },
      body,
      signal: AbortSignal.timeout(20000)
    });
    const payload = await upstream.text();
    const headers = new Headers(SECURITY);
    headers.set("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    return new Response(payload, { status: upstream.status, headers });
  } catch {
    return json({ ok: false, error: "STAGING_BACKEND_UNAVAILABLE" }, 502);
  }
}
export function backoffMinutes(attempt) {
  return BACKOFF_MINUTES[Math.min(Math.max(Number(attempt || 1) - 1, 0), BACKOFF_MINUTES.length - 1)];
}
function assertStagingTarget(env) {
  const ref = required(env, "SUPABASE_PROJECT_REF");
  const productionRef = required(env, "BCO_PRODUCTION_PROJECT_REF");
  const base = new URL(required(env, "SUPABASE_URL"));
  if (ref === productionRef || base.hostname.split(".")[0] !== ref) throw new Error("STAGING_PROJECT_REF_MISMATCH");
  return base.origin;
}
async function supabaseRequest(env, path, options = {}) {
  const base = assertStagingTarget(env);
  const key = required(env, "SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(base + "/rest/v1/" + path, {
    ...options,
    headers: {
      apikey: key, authorization: "Bearer " + key, "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) throw new Error("SUPABASE_HTTP_" + response.status);
  return data;
}
function executorUrl(env) {
  const raw = required(env, "AUTOMATION_EXECUTOR_URL");
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("EXECUTOR_URL_MUST_BE_HTTPS");
  const stagingRef = required(env, "SUPABASE_PROJECT_REF");
  if (url.hostname !== stagingRef + ".supabase.co") throw new Error("EXECUTOR_URL_PROJECT_MISMATCH");
  return url.toString();
}
async function fallbackFinish(env, item, reason) {
  const query = "automation_runs?select=id,status,lease_expires_at&id=eq." + encodeURIComponent(item.run_id) +
    "&automation_id=eq." + encodeURIComponent(item.automation_id) +
    "&organization_id=eq." + encodeURIComponent(item.organization_id) + "&limit=1";
  const rows = await supabaseRequest(env, query);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || row.status !== "running") return "already_finalized_or_not_found";
  if (!row.lease_expires_at || Date.parse(row.lease_expires_at) <= Date.now()) return "expired_lease_reaper";

  const slug = String(item.action_config && item.action_config.agent || "");
  if (slug) {
    const agents = await supabaseRequest(env,
      "ai_agents?select=id,slug&organization_id=eq." + encodeURIComponent(item.organization_id) +
      "&slug=eq." + encodeURIComponent(slug) + "&limit=1");
    const agent = Array.isArray(agents) ? agents[0] : null;
    if (agent) {
      await supabaseRequest(env, "rpc/record_bco_executor_audit", {
        method: "POST",
        body: JSON.stringify({
          p_organization_id: item.organization_id, p_automation_id: item.automation_id,
          p_agent_id: agent.id, p_agent_slug: agent.slug, p_task: "worker_dispatch",
          p_run_id: item.run_id, p_status: "failed", p_provider: null, p_model: null,
          p_error: reason, p_event_type: "automation_run_dispatch_failed",
          p_payload: { run_id: item.run_id, reason }
        })
      });
    }
  }
  const retryAt = new Date(Date.now() + backoffMinutes(item.attempt_count || 1) * 60000).toISOString();
  await supabaseRequest(env, "rpc/finish_bco_automation_run", {
    method: "POST",
    body: JSON.stringify({
      p_run_id: item.run_id, p_automation_id: item.automation_id, p_organization_id: item.organization_id,
      p_success: false, p_output: {}, p_error: reason.slice(0, 1000), p_retry_at: retryAt
    })
  });
  return "finished_failed";
}
export async function runTick(env, scheduledAt) {
  assertStagingTarget(env);
  const executor = executorUrl(env);
  const token = required(env, "AUTOMATION_EXECUTOR_TOKEN");

  const slot = new Date(Math.floor(new Date(scheduledAt || Date.now()).getTime() / 300000) * 300000).toISOString();
  const claimed = await supabaseRequest(env, "rpc/claim_bco_automation_runs", {
    method: "POST", body: JSON.stringify({ p_slot: slot, p_limit: MAX_BATCH })
  });
  const items = Array.isArray(claimed) ? claimed : [];
  const results = await Promise.all(items.map(async (item) => {
    try {
      const response = await fetch(executor, {
        method: "POST",
        headers: { authorization: "Bearer " + token, "content-type": "application/json" },
        body: JSON.stringify({ automation_id: item.automation_id, organization_id: item.organization_id, run_id: item.run_id })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.ok !== true || body.finalized !== true ||
          !["completed", "failed"].includes(body.status)) {
        throw new Error("EXECUTOR_HTTP_" + response.status + "_" + String(body.error || body.reason || "INVALID_FINALIZATION").slice(0, 180));
      }
      return { run_id: item.run_id, status: body.status, reason: body.reason || null, audit_written: body.audit_written === true };
    } catch (error) {
      const reason = String(error && error.message || "EXECUTOR_DISPATCH_FAILED").slice(0, 1000);
      try {
        const fallback = await fallbackFinish(env, item, reason);
        return { run_id: item.run_id, status: "failed", reason, fallback };
      } catch {
        return { run_id: item.run_id, status: "pending_reaper", reason: "FALLBACK_FINALIZATION_FAILED" };
      }
    }
  }));
  return { ok: true, slot, claimed: items.length, results };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/functions/v1/bco-command-center")) {
      const origin = request.headers.get("Origin");
      if (origin && origin !== url.origin) return json({ ok: false, error: "ORIGIN_NOT_ALLOWED" }, 403);
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: {
          "Access-Control-Allow-Origin": url.origin,
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "authorization,content-type",
          "Vary": "Origin",
          "Cache-Control": "no-store"
        }});
      }
    }
    if (url.pathname === "/api/health" && request.method === "GET") {
      let staging = false;
      try { stagingOrigin(env); staging = true; } catch {}
      return json({
        ok: true, version: "17-max", service: "bco-cloudflare-preview",
        preview: true, backend: "staging-only", staging_configured: staging,
        scheduler_configured: Boolean(env.SUPABASE_URL && env.SUPABASE_PROJECT_REF &&
          env.SUPABASE_SERVICE_ROLE_KEY && env.AUTOMATION_EXECUTOR_URL && env.AUTOMATION_EXECUTOR_TOKEN),
        api: { session: true, revenue_proposals: true, legacy_integrations: false }
      });
    }
    if (url.pathname === "/api/session") return sessionRoute(request, env);
    if (url.pathname === "/api/revenue" || url.pathname === "/functions/v1/bco-command-center") {
      return revenueRoute(request, env, url);
    }
    if (url.pathname.startsWith("/api/")) return json({ ok: false, error: "API_NOT_MIGRATED", preview: true }, 501);
    if (request.method !== "GET" && request.method !== "HEAD") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
    const rewrites = { "/projects": "/projects.html", "/fve": "/fve.html", "/nrsm": "/nrsm.html", "/mazliprint": "/mazliprint.html" };
    const rewritten = rewrites[url.pathname];
    if (rewritten) {
      url.pathname = rewritten;
      return env.ASSETS.fetch(new Request(url.toString(), { method: request.method, headers: request.headers }));
    }
    if (!env.ASSETS) return json({ ok: false, error: "STATIC_ASSETS_NOT_BOUND" }, 503);
    return env.ASSETS.fetch(request);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runTick(env, new Date(event.scheduledTime))
      .then((result) => console.log(JSON.stringify({ event: "automation_tick_complete", ...result })))
      .catch((error) => console.error(JSON.stringify({ event: "automation_tick_failed", code: String(error && error.message || error).slice(0, 240) }))));
  }
};
