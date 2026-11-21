const BACKOFF_MINUTES = [5, 15, 60];
const MAX_BATCH = 20;
const SOURCE = "https://raw.githubusercontent.com/lickovci-cpu/Business-Control-ONE-17-MAX-/infra/cloudflare-workers-preview-2026-11-21/public";
const SOURCE_VERSION = "f16a138ffde8e16469682ff76c3823901dd60709";
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self' blob:; manifest-src 'self'; worker-src 'none'; form-action 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'";
const ALLOWED = new Set([
  "/_headers", "/app.js", "/assets/distribution/fve-feed-01.svg", "/assets/distribution/fve-feed-02.svg",
  "/assets/distribution/nrsm-feed-01.svg", "/assets/distribution/nrsm-feed-02.svg", "/boot.js",
  "/commercial-live.js", "/crm-live.js", "/fve.html", "/icon.svg", "/index.html", "/manifest.webmanifest",
  "/mazliprint.html", "/nrsm.html", "/projects.html", "/robots.txt", "/sitemap.xml", "/studio",
  "/studio-entry", "/studio-status.js", "/studio.css", "/studio.html", "/studio.js", "/styles.css", "/sw.js"
]);
const REWRITES = { "/projects": "/projects.html", "/fve": "/fve.html", "/nrsm": "/nrsm.html", "/mazliprint": "/mazliprint.html" };
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8"
};
const SECURITY = {
  "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "DENY",
  "Content-Security-Policy": CSP, "Cache-Control": "no-store", "X-Preview-Source": "isolated-github-branch"
};
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...SECURITY, "Content-Type": "application/json; charset=utf-8" } });
}
function mime(path) {
  const ext = path.includes(".") ? path.slice(path.lastIndexOf(".")) : "";
  return TYPES[ext] || "text/html; charset=utf-8";
}
function required(env, key) {
  const value = env[key];
  if (!value) throw new Error("MISSING_" + key);
  return value;
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
    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({
        ok: true, service: "bco-cloudflare-preview", preview: true, backend: "staging-only",
        scheduler_configured: Boolean(env.SUPABASE_URL && env.SUPABASE_PROJECT_REF &&
          env.SUPABASE_SERVICE_ROLE_KEY && env.AUTOMATION_EXECUTOR_URL && env.AUTOMATION_EXECUTOR_TOKEN)
      });
    }
    if (url.pathname.startsWith("/api/")) return json({ ok: false, error: "PREVIEW_BACKEND_NOT_CONNECTED", preview: true }, 503);
    if (request.method !== "GET" && request.method !== "HEAD") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
    let path;
    try { path = decodeURIComponent(url.pathname); } catch { return json({ ok: false, error: "INVALID_PATH" }, 400); }
    if (path === "/") path = "/index.html";
    if (REWRITES[path]) path = REWRITES[path];
    if (path.includes("\\") || path.includes("\0") || path.split("/").includes("..")) return json({ ok: false, error: "INVALID_PATH" }, 400);
    if (!ALLOWED.has(path)) return json({ ok: false, error: "NOT_FOUND" }, 404);
    let upstream;
    try { upstream = await fetch(SOURCE + path + "?v=" + SOURCE_VERSION, { method: request.method, headers: { Accept: "*/*" } }); }
    catch (error) { return json({ ok: false, error: "PREVIEW_ASSET_SOURCE_UNAVAILABLE", detail: String(error).slice(0, 180) }, 502); }
    if (!upstream.ok) return json({ ok: false, error: "PREVIEW_ASSET_NOT_FOUND" }, 404);
    const headers = new Headers(SECURITY);
    headers.set("Content-Type", mime(path));
    return new Response(request.method === "HEAD" ? null : upstream.body, { status: 200, headers });
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runTick(env, new Date(event.scheduledTime))
      .then((result) => console.log(JSON.stringify({ event: "automation_tick_complete", ...result })))
      .catch((error) => console.error(JSON.stringify({ event: "automation_tick_failed", code: String(error && error.message || error).slice(0, 240) }))));
  }
};
