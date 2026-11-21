import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Json = Record<string, unknown>;
type RunContext = {
  runId: string;
  automationId: string;
  organizationId: string;
  attemptCount: number;
};
type AgentContext = { id: string; slug: string; allowedActions: Set<string> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXTERNAL_ACTIONS = new Set(["send_email", "publish", "schedule", "spend", "external_write", "production_deploy"]);
const REQUIRED_PROVIDER_ENV = ["AI_PROVIDER", "AI_PROVIDER_MODEL", "AI_PROVIDER_URL", "AI_PROVIDER_API_KEY"] as const;
const BACKOFF_MINUTES = [5, 15, 60] as const;

function jsonResponse(status: number, body: Json): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
function denied(status: number, error: string, extra: Json = {}): Response {
  return jsonResponse(status, { ok: false, error, ...extra });
}
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aa = enc.encode(a), bb = enc.encode(b);
  let diff = aa.length ^ bb.length;
  const n = Math.max(aa.length, bb.length);
  for (let i = 0; i < n; i++) diff |= (aa[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}
function stringValue(v: unknown): string { return typeof v === "string" ? v.trim() : ""; }
function isUuid(v: unknown): v is string { return typeof v === "string" && UUID.test(v); }
function asJson(v: unknown): Json { return v && typeof v === "object" && !Array.isArray(v) ? v as Json : {}; }
function allowedActions(v: unknown): Set<string> {
  return Array.isArray(v) ? new Set(v.filter((x): x is string => typeof x === "string")) : new Set();
}
function retryAt(attemptCount: number): string {
  const attempt = Number.isInteger(attemptCount) && attemptCount > 0 ? attemptCount : 1;
  const minutes = BACKOFF_MINUTES[Math.min(attempt - 1, BACKOFF_MINUTES.length - 1)];
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

async function finalizeFailure(
  db: ReturnType<typeof createClient>,
  run: RunContext,
  reason: string,
  agent: AgentContext | null,
  provider: string | null = null,
  model: string | null = null
): Promise<Response> {
  let auditWritten = false;
  let auditError = false;

  if (agent) {
    const audit = await db.rpc("record_bco_executor_audit", {
      p_organization_id: run.organizationId,
      p_automation_id: run.automationId,
      p_agent_id: agent.id,
      p_agent_slug: agent.slug,
      p_task: "automation_executor",
      p_run_id: run.runId,
      p_status: "failed",
      p_provider: provider,
      p_model: model,
      p_error: reason,
      p_event_type: "automation_run_blocked",
      p_payload: { run_id: run.runId, automation_id: run.automationId, reason }
    });
    auditWritten = !audit.error;
    auditError = Boolean(audit.error);
    if (audit.error) console.error("automation-executor audit failed", { code: "AUDIT_WRITE_FAILED" });
  }

  // The RPC is the single authority for tenant scope, running status and lease validity.
  // Never patch a row directly or try to finish a lease after it expires.
  const finish = await db.rpc("finish_bco_automation_run", {
    p_run_id: run.runId,
    p_automation_id: run.automationId,
    p_organization_id: run.organizationId,
    p_success: false,
    p_output: {},
    p_error: reason,
    p_retry_at: retryAt(run.attemptCount)
  });
  if (finish.error) {
    console.error("automation-executor finish failed", { code: "RUN_FINALIZATION_FAILED" });
    return denied(409, "RUN_FINALIZATION_FAILED", { reason, audit_written: auditWritten, audit_error: auditError });
  }

  // HTTP 200 means the run has been finalized, not that the task succeeded.
  // This prevents the Worker from attempting a second finish on the same run.
  return jsonResponse(200, {
    ok: true,
    finalized: true,
    status: "failed",
    reason,
    audit_written: auditWritten,
    audit_error: auditError
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return denied(405, "METHOD_NOT_ALLOWED");

  const configuredToken = Deno.env.get("AUTOMATION_EXECUTOR_TOKEN") ?? "";
  if (!configuredToken) return denied(503, "EXECUTOR_TOKEN_NOT_CONFIGURED");
  const auth = req.headers.get("authorization") ?? "";
  const suppliedToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!suppliedToken || !safeEqual(suppliedToken, configuredToken)) return denied(401, "UNAUTHORIZED");

  let body: Json;
  try { body = asJson(await req.json()); } catch { return denied(400, "INVALID_JSON"); }
  const runId = body.run_id, automationId = body.automation_id, organizationId = body.organization_id;
  if (![runId, automationId, organizationId].every(isUuid)) return denied(400, "INVALID_IDENTIFIERS");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return denied(503, "BACKEND_NOT_CONFIGURED");

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let run: RunContext | null = null;
  let agent: AgentContext | null = null;
  let provider: string | null = null;
  let model: string | null = null;

  try {
    const runResult = await db.from("automation_runs")
      .select("id,automation_id,organization_id,status,lease_expires_at,attempt_count")
      .eq("id", runId).eq("automation_id", automationId).eq("organization_id", organizationId)
      .maybeSingle();
    if (runResult.error) throw runResult.error;
    const runRow = runResult.data as Json | null;
    if (!runRow) return denied(409, "RUN_NOT_FOUND_OR_WRONG_TENANT");
    if (runRow.status !== "running") return denied(409, "RUN_NOT_ACTIVE");
    if (typeof runRow.lease_expires_at !== "string" || Date.parse(runRow.lease_expires_at) <= Date.now()) {
      // The claim RPC reaps expired leases. A stale worker must not finish another attempt.
      return denied(409, "RUN_LEASE_EXPIRED");
    }
    run = {
      runId: String(runRow.id),
      automationId: String(runRow.automation_id),
      organizationId: String(runRow.organization_id),
      attemptCount: Number.isInteger(runRow.attempt_count) ? Number(runRow.attempt_count) : 1
    };

    const automationResult = await db.from("automations")
      .select("id,organization_id,active,action_config")
      .eq("id", automationId).eq("organization_id", organizationId).maybeSingle();
    if (automationResult.error) throw automationResult.error;
    const automation = automationResult.data as Json | null;
    if (!automation) return await finalizeFailure(db, run, "AUTOMATION_NOT_FOUND_OR_WRONG_TENANT", null);
    const actionConfig = asJson(automation.action_config);
    const slug = stringValue(actionConfig.agent);

    if (slug) {
      const agentResult = await db.from("ai_agents")
        .select("id,organization_id,slug,active,allowed_actions,config")
        .eq("organization_id", organizationId).eq("slug", slug).maybeSingle();
      if (agentResult.error) throw agentResult.error;
      const foundAgent = agentResult.data as Json | null;
      if (foundAgent) {
        agent = {
          id: String(foundAgent.id),
          slug: String(foundAgent.slug),
          allowedActions: allowedActions(foundAgent.allowed_actions)
        };
        if (foundAgent.active !== true) return await finalizeFailure(db, run, "AGENT_NOT_ACTIVE", agent);
      }
    }

    if (automation.active !== true) return await finalizeFailure(db, run, "AUTOMATION_NOT_ACTIVE", agent);
    if (!agent) return await finalizeFailure(db, run, "AGENT_NOT_FOUND_OR_WRONG_TENANT", null);

    const action = stringValue(actionConfig.action);
    if (!slug || !action) return await finalizeFailure(db, run, "AUTOMATION_ACTION_NOT_CONFIGURED", agent);

    const agentResult = await db.from("ai_agents")
      .select("id,organization_id,slug,active,allowed_actions,config")
      .eq("organization_id", organizationId).eq("slug", slug).maybeSingle();
    if (agentResult.error) throw agentResult.error;
    const agentRow = agentResult.data as Json | null;
    const agentConfig = asJson(agentRow?.config);
    const concreteActions: string[] =
      action === "autonomous_tick" && slug === "ceo" && agentConfig.mode === "autonomous-planner"
        ? ["prioritize", "recommend"]
        : action === "audit_registered_websites" && slug === "web"
          ? ["read_site", "audit_site"]
          : action === "classify_new_messages" && slug === "email"
            ? ["read_email", "classify_email"]
            : [];
    if (concreteActions.length === 0 || concreteActions.some((x) => !agent.allowedActions.has(x))) {
      return await finalizeFailure(db, run, "ACTION_NOT_ALLOWED", agent);
    }

    const proposed = Array.isArray(actionConfig.operations) ? actionConfig.operations : [];
    for (const item of proposed) {
      const operation = stringValue(asJson(item).action);
      if (!operation || !agent.allowedActions.has(operation)) {
        return await finalizeFailure(db, run, "ACTION_NOT_ALLOWED", agent);
      }
      if (EXTERNAL_ACTIONS.has(operation)) {
        const approval = await db.from("ai_approvals").select("id")
          .eq("organization_id", organizationId).eq("agent_id", agent.id)
          .eq("action_type", operation).eq("status", "approved").is("executed_at", null)
          .contains("payload", { automation_run_id: runId }).maybeSingle();
        if (approval.error) throw approval.error;
        return await finalizeFailure(
          db,
          run,
          approval.data ? "EXTERNAL_ACTIONS_DISABLED_IN_INITIAL_RELEASE" : "APPROVAL_REQUIRED",
          agent
        );
      }
    }

    const missing = REQUIRED_PROVIDER_ENV.filter((key) => !stringValue(Deno.env.get(key)));
    const providerReady = missing.length === 0;
    provider = providerReady ? stringValue(Deno.env.get("AI_PROVIDER")) : null;
    model = providerReady ? stringValue(Deno.env.get("AI_PROVIDER_MODEL")) : null;
    const reason = providerReady ? "PROVIDER_ADAPTER_NOT_IMPLEMENTED" : "PROVIDER_SECRET_MISSING";
    return await finalizeFailure(db, run, reason, agent, provider, model);
  } catch (error) {
    console.error("automation-executor", { code: "EXECUTOR_INTERNAL_ERROR", detail: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
    if (run) {
      try { return await finalizeFailure(db, run, "EXECUTOR_INTERNAL_ERROR", agent, provider, model); }
      catch { return denied(500, "EXECUTOR_FINALIZATION_FAILED"); }
    }
    return denied(500, "EXECUTOR_INTERNAL_ERROR");
  }
});
