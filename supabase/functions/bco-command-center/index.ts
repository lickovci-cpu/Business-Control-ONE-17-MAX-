import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SEARCH_FIELDS, activeFilter, searchOr } from "./core.js";

type Json = Record<string, unknown>;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const PUBLISHABLE_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const DEFAULT_ORIGINS = ["https://business-control-one.vercel.app", "http://localhost:3000", "http://localhost:5173"];

function allowedOrigins(): Set<string> {
  const configured = (Deno.env.get("BCO_ALLOWED_ORIGINS") || "").split(",").map((x) => x.trim()).filter(Boolean);
  return new Set([...DEFAULT_ORIGINS, ...configured]);
}
function corsHeaders(req: Request): Headers {
  const h = new Headers({
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  const origin = req.headers.get("Origin");
  if (origin && allowedOrigins().has(origin)) h.set("Access-Control-Allow-Origin", origin);
  return h;
}
function json(req: Request, body: Json, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}
function getClient(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization) throw Object.assign(new Error("AUTH_REQUIRED"), { status: 401 });
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) throw Object.assign(new Error("BACKEND_NOT_CONFIGURED"), { status: 503 });
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
async function resolveOrganization(client: ReturnType<typeof getClient>, requested: string | null) {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw Object.assign(new Error("AUTH_INVALID"), { status: 401 });
  let query = client.from("memberships").select("organization_id,created_at").eq("user_id", userData.user.id);
  if (requested) query = query.eq("organization_id", requested);
  const { data, error } = await query.order("created_at", { ascending: true }).limit(requested ? 1 : 20);
  if (error) throw error;
  if (!data?.length) throw Object.assign(new Error("ORGANIZATION_ACCESS_DENIED"), { status: 403 });
  if (requested) return requested;
  if (data.length !== 1) throw Object.assign(new Error("ORGANIZATION_SELECTION_REQUIRED"), { status: 409 });
  return data[0].organization_id as string;
}
async function listCount(client: ReturnType<typeof getClient>, table: string, orgId: string) {
  let query = client.from(table).select("id", { count: "exact", head: true }).eq("organization_id", orgId);
  if (table !== "contacts") {
    const filter = activeFilter(table);
    query = query.not(filter.column, "in", filter.values);
  }
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}
async function dashboard(client: ReturnType<typeof getClient>, orgId: string) {
  const { data, error } = await client.rpc("bco_dashboard_metrics", { target_org_id: orgId });
  if (error) throw error;
  return data;
}
async function search(client: ReturnType<typeof getClient>, orgId: string, term: string) {
  const pattern = String(term || "").trim();
  const [contacts, leads, opportunities, tasks] = await Promise.all([
    client.from("contacts").select("id,name,email,phone,address").eq("organization_id", orgId).or(searchOr(SEARCH_FIELDS.contacts, pattern)).limit(15),
    client.from("leads").select("id,contact_id,source,status,estimated_value,note,contacts(name,email,phone)").eq("organization_id", orgId).or(searchOr(SEARCH_FIELDS.leads, pattern)).limit(15),
    client.from("opportunities").select("id,title,stage,priority,value,probability,contact_id,owner_user_id,source,next_action,next_action_at,notes").eq("organization_id", orgId).or(searchOr(SEARCH_FIELDS.opportunities, pattern)).limit(15),
    client.from("tasks").select("id,title,status,priority,due_at,assigned_to,entity_type,entity_id").eq("organization_id", orgId).or(searchOr(SEARCH_FIELDS.tasks, pattern)).limit(15)
  ]);
  for (const result of [contacts, leads, opportunities, tasks]) if (result.error) throw result.error;
  return { contacts: contacts.data ?? [], leads: leads.data ?? [], opportunities: opportunities.data ?? [], tasks: tasks.data ?? [] };
}
function localAnalysis(data: unknown) {
  return {
    provider: "rules",
    message: "AI provider není nakonfigurován; použita je deterministická provozní analýza bez externího volání.",
    data,
    recommendations: [
      "Prioritizuj otevřené a po termínu úkoly.",
      "Sleduj příležitosti s vysokou hodnotou a nízkou aktivitou.",
      "Každý aktivní lead by měl mít další krok a vlastníka."
    ]
  };
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins().has(origin)) return new Response("Origin not allowed", { status: 403, headers: { "Vary": "Origin" } });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  try {
    const client = getClient(req);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "health";
    if (action === "health") return json(req, { ok: true, service: "bco-command-center" });
    const orgId = await resolveOrganization(client, url.searchParams.get("organization_id"));
    if (action === "dashboard") return json(req, { ok: true, organization_id: orgId, metrics: await dashboard(client, orgId) });
    if (action === "search") {
      const term = url.searchParams.get("q") ?? "";
      if (term.trim().length < 2) return json(req, { ok: true, organization_id: orgId, results: { contacts: [], leads: [], opportunities: [], tasks: [] } });
      return json(req, { ok: true, organization_id: orgId, results: await search(client, orgId, term) });
    }
    if (action === "analyze") return json(req, { ok: true, organization_id: orgId, analysis: localAnalysis(await dashboard(client, orgId)) });
    if (action === "summary") {
      const [contacts, leads, opportunities, tasks, jobs, quotes] = await Promise.all([
        listCount(client, "contacts", orgId),
        listCount(client, "leads", orgId),
        listCount(client, "opportunities", orgId),
        listCount(client, "tasks", orgId),
        listCount(client, "jobs", orgId),
        listCount(client, "quotes", orgId)
      ]);
      return json(req, { ok: true, organization_id: orgId, summary: { contacts, leads, opportunities, tasks, jobs, quotes } });
    }
    return json(req, { ok: false, error: "UNKNOWN_ACTION" }, 400);
  } catch (error) {
    const status = Number((error as { status?: number }).status) || 500;
    const code = error instanceof Error ? error.message : "INTERNAL_ERROR";
    console.error("bco-command-center", { status, code });
    return json(req, { ok: false, error: status >= 500 ? "INTERNAL_ERROR" : code }, status);
  }
});
