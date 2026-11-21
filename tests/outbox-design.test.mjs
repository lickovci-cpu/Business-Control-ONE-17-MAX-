import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(new URL("../docs/integration-outbox-schema-proposal.sql", import.meta.url), "utf8");
const cron = await readFile(new URL("../docs/FOUR-CRON-JOBS.md", import.meta.url), "utf8");
const auth = await readFile(new URL("../docs/STORAGE-AUTH-DESIGN.md", import.meta.url), "utf8");

test("outbox has organization-scoped idempotency and bounded retries", () => {
  assert.match(sql, /unique\s*\(organization_id,\s*dedupe_key\)/i);
  assert.match(sql, /max_attempts\s+integer[^,]*default\s+8/i);
  assert.match(sql, /status\s*=\s*'dead'/i);
  assert.match(sql, /available_at\s*=\s*case when v_status = 'retry'/i);
});

test("claim is atomic and concurrency-safe", () => {
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /return query[\s\S]*with candidates/i);
  assert.match(sql, /lock_token\s*=\s*pg_catalog\.gen_random_uuid\(\)/i);
});

test("completion and retry require the current lease token", () => {
  assert.match(sql, /complete_integration_outbox[\s\S]*lock_token\s*=\s*p_lock_token/i);
  assert.match(sql, /fail_integration_outbox[\s\S]*lock_token\s*=\s*p_lock_token/i);
  assert.match(sql, /least\(3600/i);
  assert.match(sql, /revoke all on function/i);
});

test("four existing cron jobs and their schedules are preserved", () => {
  for (const route of ["/api/merch-cron", "/api/cron", "/api/automation-tick", "/api/outbound-cron"]) assert.ok(cron.includes(route), route);
  assert.ok(cron.includes("0 */6 * * *"));
  assert.ok(cron.includes("*/5 * * * *"));
});

test("Storage design relies on verified Supabase Auth + existing RLS, not bc_session", () => {
  assert.match(auth, /GET \/auth\/v1\/user/);
  assert.match(auth, /private\.is_org_member/);
  assert.match(auth, /private\.can_access_job/);
  assert.match(auth, /MUST NOT authorize organization-scoped Storage/);
  assert.match(auth, /bco-media.*no bucket-level/i);
});

test("webhook dedupe and outbox enqueue are one database transaction", () => {
  assert.match(sql, /enqueue_integration_event[\s\S]*on conflict \(dedupe_key\) do nothing[\s\S]*returning id/i);
  assert.match(sql, /if v_event_id is null[\s\S]*return query select v_event_id, true/i);
  assert.match(sql, /insert into public\.integration_outbox[\s\S]*return query select v_event_id, false/i);
  assert.match(sql, /grant execute on function public\.enqueue_integration_event[\s\S]*to service_role/i);
});

test("ingress idempotency key is namespaced by immutable org and provider", () => {
  assert.match(sql, /v_scoped_dedupe_key\s*:=\s*p_organization_id::text\s*\|\|\s*':'\s*\|\|\s*p_provider\s*\|\|\s*':'\s*\|\|\s*p_dedupe_key/i);
  assert.match(sql, /IDEMPOTENCY_KEY_COLLISION/);
  assert.match(sql, /length\(dedupe_key\) between 1 and 512/i);
});

test("isolated PostgreSQL integration and concurrency tests are wired into CI", async () => {
  const workflow = await readFile(new URL("../.github/workflows/cloudflare-preview.yml", import.meta.url), "utf8");
  const bootstrap = await readFile(new URL("./postgres-bootstrap.sql", import.meta.url), "utf8");
  const concurrency = await readFile(new URL("./outbox-concurrency.sh", import.meta.url), "utf8");
  const storage = await readFile(new URL("./storage-rls-postgres.sh", import.meta.url), "utf8");
  assert.match(workflow, /postgres:17-alpine/);
  assert.match(workflow, /outbox-postgres\.sql/);
  assert.match(workflow, /outbox-concurrency\.sh/);
  assert.match(workflow, /storage-rls-postgres\.sh/);
  assert.match(bootstrap, /CREATE ROLE authenticated/);
  assert.match(concurrency, /claim_integration_outbox/);
  assert.match(storage, /cross-organization bco-media upload allowed/);
});
