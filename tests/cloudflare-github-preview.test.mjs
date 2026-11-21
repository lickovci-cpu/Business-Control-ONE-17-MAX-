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
    assert.equal(response.headers.get("content-security-policy"),"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://nrsm-streetwear.vercel.app https://mazliprint-final.vercel.app; font-src 'self' data:; connect-src 'self'; media-src 'self' blob:; manifest-src 'self'; worker-src 'none'; form-action 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'");
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
  assert.doesNotMatch(source,/fetch\(request\.url/);
  assert.match(source,/SOURCE\+path/);
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

test("BCO navigation rewrites resolve to allowlisted static pages", async () => {
  const aliases = [
    ["/projects","/projects.html"],
    ["/fve","/fve.html"],
    ["/nrsm","/nrsm.html"],
    ["/mazliprint","/mazliprint.html"]
  ];
  globalThis.fetch=async (url) => new Response(String(url),{status:200});
  try {
    for (const [route,target] of aliases) {
      const response=await worker.fetch(new Request("https://preview.example"+route));
      assert.equal(response.status,200);
      assert.ok((await response.text()).endsWith("/public"+target));
    }
  } finally { globalThis.fetch=originalFetch; }
});

test("every local asset referenced by the BCO mobile entry page is allowlisted", async () => {
  const html=await readFile(new URL("../public/index.html",import.meta.url),"utf8");
  const allowBlock=source.match(/const ALLOWED = new Set\(\[([\s\S]*?)\]\);/);
  const rewriteBlock=source.match(/const REWRITES = \{([^}]+)\}/);
  assert.ok(allowBlock);
  assert.ok(rewriteBlock);
  const allowed=new Set([...allowBlock[1].matchAll(/"([^"]+)"/g)].map(m=>m[1]));
  const rewrites=Object.fromEntries([...rewriteBlock[1].matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)].map(m=>[m[1],m[2]]));
  const refs=[...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map(m=>m[1]);
  for (const ref of refs) {
    if (/^(https?:|data:|mailto:|tel:|#|javascript:)/i.test(ref)) continue;
    const path=new URL(ref,"https://preview.example/").pathname;
    if (path.startsWith("/api/")) continue;
    const resolved=rewrites[path] || path;
    assert.ok(allowed.has(resolved), `unserved local reference: ${ref} -> ${resolved}`);
  }
});
