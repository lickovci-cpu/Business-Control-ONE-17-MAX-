import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../worker-github-preview.js", import.meta.url), "utf8");
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const originalFetch = globalThis.fetch;

test("health endpoint is preview-only and never claims a connected backend", async () => {
  const response = await worker.fetch(new Request("https://preview.example/api/health"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.preview, true);
  assert.equal(body.backend, "not-connected");
});

test("all API routes fail closed for every method except health GET", async () => {
  for (const path of ["/api/leads","/api/upload","/api/cron","/api/unknown"]) {
    for (const method of ["GET","POST","PUT","PATCH","DELETE"]) {
      const response = await worker.fetch(new Request("https://preview.example"+path,{method}));
      assert.equal(response.status,503);
      assert.equal((await response.json()).error,"PREVIEW_BACKEND_NOT_CONNECTED");
    }
  }
});

test("mobile root is served from the isolated branch with security headers", async () => {
  let requested="";
  globalThis.fetch=async (url) => {
    requested=String(url);
    return new Response('<html><head><meta name="viewport" content="width=device-width"></head><body>Preview</body></html>',{status:200});
  };
  try {
    const response=await worker.fetch(new Request("https://preview.example/"));
    const html=await response.text();
    assert.equal(response.status,200);
    assert.ok(requested.endsWith("/public/index.html"));
    assert.match(html,/name="viewport"/);
    assert.equal(response.headers.get("x-robots-tag"),"noindex, nofollow, noarchive");
    assert.equal(response.headers.get("x-content-type-options"),"nosniff");
    assert.equal(response.headers.get("content-security-policy"),"connect-src 'self'; form-action 'self'; worker-src 'none'");
    assert.equal(response.headers.get("x-preview-source"),"isolated-github-branch");
  } finally { globalThis.fetch=originalFetch; }
});

test("mobile JS and CSS paths are allowlisted with correct content types", async () => {
  globalThis.fetch=async () => new Response("asset",{status:200});
  try {
    const js=await worker.fetch(new Request("https://preview.example/app.js"));
    const css=await worker.fetch(new Request("https://preview.example/styles.css"));
    assert.equal(js.headers.get("content-type"),"text/javascript; charset=utf-8");
    assert.equal(css.headers.get("content-type"),"text/css; charset=utf-8");
  } finally { globalThis.fetch=originalFetch; }
});

test("unknown paths and non-read static methods are rejected", async () => {
  const missing=await worker.fetch(new Request("https://preview.example/unknown.js"));
  const write=await worker.fetch(new Request("https://preview.example/",{method:"POST"}));
  assert.equal(missing.status,404);
  assert.equal(write.status,405);
});

test("HEAD is supported without returning an asset body", async () => {
  globalThis.fetch=async () => new Response("asset",{status:200});
  try {
    const response=await worker.fetch(new Request("https://preview.example/app.js",{method:"HEAD"}));
    assert.equal(response.status,200);
    assert.equal(await response.text(),"");
  } finally { globalThis.fetch=originalFetch; }
});

test("preview worker has no server-side credentials or arbitrary proxy target", () => {
  assert.doesNotMatch(source,/sb_secret_|service_role|BLOB_READ_WRITE_TOKEN|SUPABASE_SECRET_KEY/i);
  assert.match(source,/raw\.githubusercontent\.com\/lickovci-cpu\/Business-Control-ONE-17-MAX-/);
  assert.doesNotMatch(source,/request\.url\s*\)/);
});

test("upstream failure is converted into a bounded preview 502", async () => {
  globalThis.fetch=async () => { throw new Error("network unavailable"); };
  try {
    const response=await worker.fetch(new Request("https://preview.example/index.html"));
    const body=await response.json();
    assert.equal(response.status,502);
    assert.equal(body.error,"PREVIEW_ASSET_SOURCE_UNAVAILABLE");
    assert.match(body.detail,/network unavailable/);
  } finally { globalThis.fetch=originalFetch; }
});
