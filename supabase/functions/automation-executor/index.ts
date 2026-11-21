import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Json = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXTERNAL_ACTIONS = new Set(["send_email", "publish", "schedule", "spend", "external_write", "production_deploy"]);
const REQUIRED_PROVIDER_ENV = ["AI_PROVIDER", "AI_PROVIDER_MODEL", "AI_PROVIDER_URL", "AI_PROVIDER_API_KEY"] as const;

function response(status: number, error: string, extra: Json = {}) {
  return new Response(JSON.stringify({ ok: false, error, ...extra }), {
    status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aa = enc.encode(a), bb = enc.encode(b);
  let diff = aa.length ^ bb.length;
  const n = Math.max(aa.length, bb.length);
  for (let i = 0; i < n; i++) diff |= (aa[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}
function stringValue(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}
function asJson(v: unknown): Json {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Json : {};
}
function allowedActions(v: unknown): Set<string> {
  if (!Array.isArray(v)) return new Set();
  return new Set(v.filter((x): x is string => typeof x === "string"));
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response(405, "METHOD_NOT_ALLOWED");
  const configuredToken = Deno.env.get("AUTOMATION_EXECUTOR_TOKEN") ?? "";
  if (!configuredToken) return response(503, "EXECUTOR_TOKEN_NOT_CONFIGURED");
  const auth = req.headers.get("authorization") ?? "";
  const suppliedToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!suppliedToken || !safeEqual(suppliedToken, configuredToken)) return response(401, "UNAUTHORIZED");

  let body: Json;
  try {
    body = asJson(await req.json());
  } catch {
    return response(400, "INVALID_JSON");
  }
  const runId = body.run_id, automationId = body.automation_id, organizationId = body.organization_id;
  if (![runId, automationId, organizationId].every(isUuid)) return response(400, "INVALID_IDENTIFIERS");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return response(503, "BACKEND_NOT_CONFIGURED");
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let trustedRun: Json | null = null;
  let automation: Json | null = null;
  let agent: Json | null = null;
  try {
    const runResult = await db.from("automation_runs")
      .select("id,automation_id,organization_id,status,lease_expires_at,attempt_count")
      .eq("id", runId).eq("automation_id", automationId).eq("organization_id", organizationId)
      .maybeSingle();
    if (runResult.error) throw runResult.error;
    trustedRun = runResult.data as Json | null;
    if (!trustedRun || trustedRun.status !== "running" ||
        typeof trustedRun.lease_expires_at !== "string" ||
        Date.parse(trustedRun.lease_expires_at) <= Date.now()) {
      return response(409, "RUN_NOT_ACTIVE_OR_LEASE_EXPIRED");
    }

    const automationResult = await db.from("automations")
      .select("id,organization_id,active,action_config,trigger_config")
      .eq("id", automationId).eq("organization_id", organizationId).maybeSingle();
    if (automationResult.error) throw automationResult.error;
    automation = automationResult.data as Json | null;
    if (!automation || automation.active !== true) return response(403, "AUTOMATION_NOT_ACTIVE");

    const actionConfig = asJson(automation.action_config);
    const slug = stringValue(actionConfig.agent);
    const action = stringValue(actionConfig.action);
    if (!slug || !action) return response(403, "AUTOMATION_ACTION_NOT_CONFIGURED");

    const agentResult = await db.from("ai_agents")
      .select("id,organization_id,slug,active,autonomy_level,allowed_actions,config")
      .eq("organization_id", organizationId).eq("slug", slug).maybeSingle();
    if (agentResult.error) throw agentResult.error;
    agent = agentResult.data as Json | null;
    if (!agent || agent.active !== true) return response(403, "AGENT_NOT_ACTIVE");

    const allowlist = allowedActions(agent.allowed_actions);
    const agentConfig = asJson(agent.config);
    const concreteActions: string[] =
      action === "autonomous_tick" && slug === "ceo" && agentConfig.mode === "autonomous-planner"
        ? ["prioritize", "recommend"]
        : action === "audit_registered_websites" && slug === "web"
          ? ["read_site", "audit_site"]
          : action === "classify_new_messages" && slug === "email"
            ? ["read_email", "classify_email"]
            : [];
    if (concreteActions.length === 0 || concreteActions.some((x) => !allowlist.has(x))) {
      return response(403, "ACTION_NOT_ALLOWED");
    }

    // This release is deliberately read/draft-only. Even a valid approval is not
    // an execution capability for sending, publishing, scheduling, spending or deployment.
    const proposed = Array.isArray(actionConfig.operations) ? actionConfig.operations : [];
    for (const item of proposed) {
      const operation = stringValue(asJson(item).action);
      if (!operation || !allowlist.has(operation)) return response(403, "ACTION_NOT_ALLOWED");
      if (EXTERNAL_ACTIONS.has(operation)) {
        const approval = await db.from("ai_approvals").select("id")
          .eq("organization_id", organizationId).eq("agent_id", agent.id)
          .eq("action_type", operation).eq("status", "approved").is("executed_at", null)
          .contains("payload", { automation_run_id: runId }).maybeSingle();
        if (approval.error) throw approval.error;
        if (!approval.data) return response(403, "APPROVAL_REQUIRED");
        return response(403, "EXTERNAL_ACTIONS_DISABLED_IN_INITIAL_RELEASE");
      }
    }

    const missing = REQUIRED_PROVIDER_ENV.filter((key) => !stringValue(Deno.env.get(key)));
    const providerReady = missing.length === 0;
    const audit = await db.rpc("record_bco_executor_audit", {
      p_organization_id: organizationId,
      p_agent_id: agent.id,
      p_agent_slug: slug,
      p_task: action,
      p_run_id: runId,
      p_status: "blocked",
      p_provider: providerReady ? Deno.env.get("AI_PROVIDER") : null,
      p_model: providerReady ? Deno.env.get("AI_PROVIDER_MODEL") : null,
      p_error: providerReady ? "PROVIDER_ADAPTER_NOT_IMPLEMENTED" : "PROVIDER_SECRET_MISSING",
      p_event_type: "automation_run_blocked",
      p_payload: { run_id: runId, automation_id: automationId, reason: providerReady ? "PROVIDER_ADAPTER_NOT_IMPLEMENTED" : "PROVIDER_SECRET_MISSING" }
    });
    if (audit.error) throw audit.error;

    const finish = await db.rpc("finish_bco_automation_run", {
      p_run_id: runId,
      p_automation_id: automationId,
      p_organization_id: organizationId,
      p_success: false,
      p_output: {},
      p_error: providerReady ? "PROVIDER_ADAPTER_NOT_IMPLEMENTED" : "PROVIDER_SECRET_MISSING",
      p_retry_at: null
    });
    if (finish.error) throw finish.error;
    return response(503, providerReady ? "PROVIDER_ADAPTER_NOT_IMPLEMENTED" : "PROVIDER_SECRET_MISSING");
  } catch (error) {
    // Do not return database/provider details to the caller and never log secrets.
    console.error("automation-executor", { code: error instanceof Error ? error.message : "INTERNAL_ERROR" });
    return response(500, "EXECUTOR_INTERNAL_ERROR");
  }
});
