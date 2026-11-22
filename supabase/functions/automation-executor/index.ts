import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Json = Record<string, unknown>;
type RunContext = {
  runId: string;
  automationId: string;
  organizationId: string;
  attemptCount: number;
};
type AgentContext = { id: string; slug: string; allowedActions: Set<string>; config: Json };

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



function classifyProject(value: unknown): string {
  const text = stringValue(value).toLowerCase();
  if (/(nrsm|nřšm|streetwear|merch|footfest|potisk|soundsystem|dnb)/i.test(text)) return "nrsm";
  if (/(mazliprint|mazli|mazlí|mazl[ií]c|mazl[ií]čk)/i.test(text)) return "mazliprint";
  if (/(local proof|proof factory|google profil|web audit|webov[eé] str[aá]nky|st[rř]ech|fve|fotovolta|zahrad|fas[aá]d|zemn[ií] pr[aá]ce)/i.test(text)) return "local-proof-factory";
  return "unassigned";
}

async function persistInternalTaskProposals(
  db: ReturnType<typeof createClient>,
  organizationId: string,
  leads: Array<Json>,
  opportunities: Array<Json>,
  now: Date
): Promise<number> {
  const proposals: Array<Json> = [];
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();

  for (const lead of leads) {
    const projectId = classifyProject([lead.source, lead.note].join(" "));
    if (projectId === "unassigned") continue;
    const status = stringValue(lead.status) || "new";
    const due = stringValue(lead.next_action_at);
    const overdue = Boolean(due && Date.parse(due) < now.getTime());
    const value = Number(lead.estimated_value ?? 0);
    const score = Math.min(1000, (overdue ? 100 : 0) + (status === "approved" ? 80 : status === "offer" ? 70 : status === "qualified" ? 60 : 30) + Math.min(Math.max(value, 0) / 1000, 50));
    proposals.push({
      organization_id: organizationId, project_id: projectId, source_type: "lead", source_id: lead.id,
      idempotency_key: "lead:" + String(lead.id) + ":next-step-v1",
      title: "Prověřit a připravit další krok u obchodního leadu",
      rationale: "Deterministický návrh podle projektu, stavu leadu " + status +
        (overdue ? " a překročeného termínu další akce." : ".") +
        " Před kontaktováním ověřit údaje a připravit návrh ke schválení.",
      score, priority: score >= 120 ? "A" : "B", due_at: due || tomorrow,
      task_notes: "Interní příprava a kontrola podkladů. Bez odeslání zprávy, telefonátu nebo jiné externí akce."
    });
  }

  for (const opportunity of opportunities) {
    const projectId = classifyProject([opportunity.source, opportunity.title, opportunity.notes].join(" "));
    if (projectId === "unassigned") continue;
    const stage = stringValue(opportunity.stage) || "lead";
    const due = stringValue(opportunity.next_action_at);
    const overdue = Boolean(due && Date.parse(due) < now.getTime());
    const priority = stringValue(opportunity.priority);
    const value = Number(opportunity.value ?? 0);
    const probability = Number(opportunity.probability ?? 0);
    const score = Math.min(1000, (overdue ? 100 : 0) + (priority === "A" ? 50 : priority === "B" ? 30 : 10) +
      Math.min(Math.max(probability, 0), 100) / 2 + Math.min(Math.max(value, 0) / 1000, 50));
    proposals.push({
      organization_id: organizationId, project_id: projectId, source_type: "opportunity", source_id: opportunity.id,
      idempotency_key: "opportunity:" + String(opportunity.id) + ":next-step-v1",
      title: "Připravit další obchodní krok u příležitosti",
      rationale: "Příležitost je ve fázi " + stage + ", priorita " + priority +
        (overdue ? " a má překročený termín další akce." : ".") +
        " Prověřit stav, hodnotu a připravit interní návrh postupu.",
      score, priority: score >= 120 ? "A" : "B", due_at: due || tomorrow,
      task_notes: "Interní příprava nabídky nebo follow-upu. Externí kontakt vyžaduje samostatné schválení."
    });
  }

  const dayKey = now.toISOString().slice(0, 10);
  const projectSeeds: Array<Json> = [
    { project_id: "local-proof-factory", title: "Připravit a ověřit 5 místních firem pro Local Proof Factory", rationale: "Vytvořit malý seznam skutečných jihočeských firem, ověřit veřejné kontakty a konkrétní nedostatek v jejich online prezentaci. Bez automatického oslovení.", score: 90, priority: "A", task_notes: "Výstup: 5 ověřených firem, zdroje, důvod relevance a návrh individuální nabídky." },
    { project_id: "nrsm", title: "Připravit 3 kvalifikované B2B merch příležitosti pro NŘŠM", rationale: "Vybrat relevantní DJs, kluby, crews nebo promotéry a připravit konkrétní merch koncept bez výroby a bez odesílání.", score: 80, priority: "B", task_notes: "Výstup: 3 ověřené subjekty, jejich veřejné kontakty, vhodný merch směr a odhadovaný další krok." },
    { project_id: "mazliprint", title: "Připravit 3 nabídky personalizovaných produktů MazliPrint", rationale: "Zkontrolovat produktové varianty a připravit konkrétní nabídky pro potenciální zákazníky. Bez nákupu materiálu a bez závazku výroby.", score: 70, priority: "B", task_notes: "Výstup: 3 produktové nabídky s cenovým rámcem, potřebnými podklady a návrhem dalšího kroku." }
  ];
  for (const item of projectSeeds) {
    proposals.push({
      organization_id: organizationId, project_id: item.project_id, source_type: "project", source_id: null,
      idempotency_key: "project:" + String(item.project_id) + ":daily:" + dayKey,
      title: item.title, rationale: item.rationale, score: item.score, priority: item.priority,
      due_at: tomorrow, task_notes: item.task_notes
    });
  }

  if (proposals.length === 0) return 0;
  const inserted = await db.from("internal_task_proposals")
    .upsert(proposals, { onConflict: "organization_id,idempotency_key", ignoreDuplicates: true })
    .select("id");
  if (inserted.error) throw new Error("INTERNAL_PROPOSAL_PERSIST_FAILED");
  return inserted.data?.length ?? 0;
}

async function buildCeoInternalPlan(db: ReturnType<typeof createClient>, organizationId: string): Promise<Json> {
  const now = new Date();
  const nowMs = now.getTime();
  const [leads, opportunities, tasks] = await Promise.all([
    db.from("leads")
      .select("id,status,estimated_value,next_action_at,created_at,source,note", { count: "exact" })
      .eq("organization_id", organizationId)
      .in("status", ["new", "contacted", "qualified", "follow_up", "offer", "approved", "job", "delivered", "invoiced"])
      .order("next_action_at", { ascending: true, nullsFirst: false })
      .limit(100),
    db.from("opportunities")
      .select("id,title,stage,priority,value,probability,next_action,next_action_at,created_at,source,notes", { count: "exact" })
      .eq("organization_id", organizationId)
      .in("stage", ["lead", "qualification", "meeting", "proposal", "negotiation"])
      .order("next_action_at", { ascending: true, nullsFirst: false })
      .limit(100),
    db.from("tasks")
      .select("id,title,status,priority,due_at,entity_type,entity_id", { count: "exact" })
      .eq("organization_id", organizationId)
      .in("status", ["open", "in_progress", "blocked"])
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(100)
  ]);
  for (const result of [leads, opportunities, tasks]) {
    if (result.error) throw new Error("INTERNAL_PLAN_QUERY_FAILED");
  }

  const candidates: Array<Json> = [];
  let overdueCount = 0;
  for (const lead of (leads.data ?? []) as Array<Json>) {
    const due = stringValue(lead.next_action_at);
    const overdue = Boolean(due && Date.parse(due) < nowMs);
    if (overdue) overdueCount++;
    const status = stringValue(lead.status);
    const value = Number(lead.estimated_value ?? 0);
    const stageScore: Record<string, number> = {
      approved: 50, offer: 45, qualified: 40, job: 35, invoiced: 35,
      follow_up: 30, contacted: 20, delivered: 15, new: 10
    };
    candidates.push({
      type: "lead", id: lead.id, status,
      estimated_value: Number.isFinite(value) ? value : 0,
      next_action_at: due || null,
      overdue,
      score: (overdue ? 100 : 0) + (stageScore[status] ?? 0) + Math.min(Math.max(value, 0) / 10000, 20)
    });
  }
  for (const opportunity of (opportunities.data ?? []) as Array<Json>) {
    const due = stringValue(opportunity.next_action_at);
    const overdue = Boolean(due && Date.parse(due) < nowMs);
    if (overdue) overdueCount++;
    const priority = stringValue(opportunity.priority);
    const stage = stringValue(opportunity.stage);
    const value = Number(opportunity.value ?? 0);
    const probability = Number(opportunity.probability ?? 0);
    const priorityScore: Record<string, number> = { A: 50, B: 30, C: 10 };
    const stageScore: Record<string, number> = {
      negotiation: 40, proposal: 35, meeting: 25, qualification: 20, lead: 10
    };
    candidates.push({
      type: "opportunity", id: opportunity.id, title: stringValue(opportunity.title),
      stage, priority, value: Number.isFinite(value) ? value : 0,
      probability: Number.isFinite(probability) ? probability : 0,
      next_action: stringValue(opportunity.next_action),
      next_action_at: due || null,
      overdue,
      score: (overdue ? 100 : 0) + (priorityScore[priority] ?? 0) + (stageScore[stage] ?? 0) +
        Math.min(Math.max(probability, 0), 100) / 10 + Math.min(Math.max(value, 0) / 10000, 20)
    });
  }
  for (const task of (tasks.data ?? []) as Array<Json>) {
    const due = stringValue(task.due_at);
    const overdue = Boolean(due && Date.parse(due) < nowMs);
    if (overdue) overdueCount++;
    const priority = stringValue(task.priority);
    const status = stringValue(task.status);
    const priorityScore: Record<string, number> = { A: 50, B: 30, C: 10 };
    candidates.push({
      type: "task", id: task.id, title: stringValue(task.title), status, priority,
      due_at: due || null, overdue,
      score: (overdue ? 100 : 0) + (priorityScore[priority] ?? 0) + (status === "blocked" ? 20 : 0)
    });
  }
  candidates.sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0));
  const priorities = candidates.slice(0, 10);
  const proposalsCreated = await persistInternalTaskProposals(db, organizationId,
    (leads.data ?? []) as Array<Json>, (opportunities.data ?? []) as Array<Json>, now);
  const recommendations: string[] = [];
  if (overdueCount > 0) recommendations.push("Nejprve vyřeš " + overdueCount + " položek po termínu.");
  if ((leads.count ?? 0) > 0) recommendations.push("Zkontroluj další kroky u otevřených leadů a doplň termíny kontaktování.");
  if ((opportunities.count ?? 0) > 0) recommendations.push("Posuň obchodní příležitosti s nejvyšší prioritou a pravděpodobností.");
  if ((tasks.count ?? 0) > 0) recommendations.push("Vyřeš úkoly podle priority a termínu, zejména blokované položky.");
  if (recommendations.length === 0) recommendations.push("Pipeline je prázdná. Nejdřív vlož ověřené leady nebo úkoly; žádné záznamy nebyly vytvořeny automaticky.");
  return {
    mode: "deterministic_internal_planner",
    generated_at: now.toISOString(),
    organization_id: organizationId,
    counts: {
      open_leads: leads.count ?? 0,
      active_opportunities: opportunities.count ?? 0,
      open_tasks: tasks.count ?? 0,
      proposals_created: proposalsCreated,
      overdue_in_sample: overdueCount,
      sample_limit_per_table: 100
    },
    priorities,
    recommendations,
    side_effects: "internal_proposals_only_no_external_actions"
  };
}

async function finalizeSuccess(
  db: ReturnType<typeof createClient>,
  run: RunContext,
  agent: AgentContext,
  output: Json
): Promise<Response> {
  const audit = await db.rpc("record_bco_executor_audit", {
    p_organization_id: run.organizationId,
    p_automation_id: run.automationId,
    p_agent_id: agent.id,
    p_agent_slug: agent.slug,
    p_task: "autonomous_tick",
    p_run_id: run.runId,
    p_status: "completed",
    p_provider: null,
    p_model: null,
    p_error: null,
    p_event_type: "automation_run_completed",
    p_payload: output
  });
  if (audit.error || typeof audit.data !== "string") {
    console.error("automation-executor success audit failed", { code: "AUDIT_WRITE_FAILED" });
    return await finalizeFailure(db, run, "AUDIT_WRITE_FAILED", agent);
  }

  const aiRunUpdate = await db.from("ai_runs").update({ output }).eq("id", audit.data)
    .eq("organization_id", run.organizationId);
  if (aiRunUpdate.error) {
    console.error("automation-executor output audit update failed", { code: "AI_RUN_OUTPUT_UPDATE_FAILED" });
  }

  const finish = await db.rpc("finish_bco_automation_run", {
    p_run_id: run.runId,
    p_automation_id: run.automationId,
    p_organization_id: run.organizationId,
    p_success: true,
    p_output: output,
    p_error: null,
    p_retry_at: null
  });
  if (finish.error) {
    await db.from("ai_runs").update({
      status: "failed", error: "RUN_FINALIZATION_FAILED", completed_at: new Date().toISOString()
    }).eq("id", audit.data).eq("organization_id", run.organizationId);
    return denied(409, "RUN_FINALIZATION_FAILED", { audit_written: true });
  }
  return jsonResponse(200, {
    ok: true, finalized: true, status: "completed", audit_written: true,
    mode: "deterministic_internal_planner"
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
          allowedActions: allowedActions(foundAgent.allowed_actions),
          config: asJson(foundAgent.config)
        };
        if (foundAgent.active !== true) return await finalizeFailure(db, run, "AGENT_NOT_ACTIVE", agent);
      }
    }

    if (automation.active !== true) return await finalizeFailure(db, run, "AUTOMATION_NOT_ACTIVE", agent);
    if (!agent) return await finalizeFailure(db, run, "AGENT_NOT_FOUND_OR_WRONG_TENANT", null);

    const action = stringValue(actionConfig.action);
    if (!slug || !action) return await finalizeFailure(db, run, "AUTOMATION_ACTION_NOT_CONFIGURED", agent);

    const agentConfig = agent.config;
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

    if (action === "autonomous_tick" && slug === "ceo" && agent.config.mode === "autonomous-planner") {
      const plan = await buildCeoInternalPlan(db, organizationId);
      return await finalizeSuccess(db, run, agent, plan);
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
