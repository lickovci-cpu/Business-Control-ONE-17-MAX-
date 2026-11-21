import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../worker.js';

const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const assets = { fetch: async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }) };

test('health is preview-only and reports backend disconnected', async () => {
  const r=await worker.fetch(new Request('https://preview.invalid/api/health'),{ASSETS:assets});
  assert.equal(r.status,200);
  assert.equal((await r.json()).backend,'not-connected');
});

test('all non-health API methods and routes fail closed', async () => {
  for (const path of ['/api/upload','/api/leads','/api/cron','/api/unknown']) {
    for (const method of ['GET','POST','PUT','PATCH','DELETE']) {
      const r=await worker.fetch(new Request('https://preview.invalid'+path,{method}),{ASSETS:assets});
      assert.equal(r.status,503);
      assert.equal((await r.json()).error,'PREVIEW_BACKEND_NOT_CONNECTED');
    }
  }
});

test('mobile BCO shell has viewport, responsive CSS and existing local assets', async () => {
  assert.match(html, /<meta[^>]+name=["']viewport["']/i);
  assert.ok(css.includes('@media') || css.includes('max-width'), 'responsive CSS breakpoint missing');
  const refs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^(https?:|data:|mailto:|tel:|#|javascript:)/i.test(ref) || ref.includes('$') || ref.includes('{')) continue;
    const path = new URL(ref, 'https://preview.invalid').pathname.replace(/^\/+/, '');
    if (!path || !path.includes('.')) continue;
    await access(resolve(publicDir, path));
  }
});

test('static response is noindex, nosniff and blocks external connections', async () => {
  const r=await worker.fetch(new Request('https://preview.invalid/'),{ASSETS:assets});
  assert.equal(r.status,200);
  assert.match(r.headers.get('x-robots-tag'),/noindex/);
  assert.equal(r.headers.get('x-content-type-options'),'nosniff');
  assert.equal(r.headers.get('content-security-policy'),"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self' blob:; manifest-src 'self'; worker-src 'none'; form-action 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'");
});

test('API health also carries preview CSP', async () => {
  const r=await worker.fetch(new Request('https://preview.invalid/api/health'),{ASSETS:assets});
  assert.match(r.headers.get('content-security-policy'),/connect-src 'self'/);
});

test('public bundle contains no server-side credentials', async () => {
  const files = ['app.js','boot.js','commercial-live.js','crm-live.js','studio.js'];
  for (const file of files) {
    const body = await readFile(new URL('../public/' + file, import.meta.url), 'utf8');
    assert.doesNotMatch(body, /sb_secret_|service_role|OPENAI_API_KEY|BLOB_READ_WRITE_TOKEN|BCO_INTEGRATION_SECRET/i, file);
  }
});

test('writes outside API are rejected', async () => {
  const r=await worker.fetch(new Request('https://preview.invalid/',{method:'POST'}),{ASSETS:assets});
  assert.equal(r.status,405);
});


test('Worker only runs on API paths and preview-only mode is enabled', async () => {
  const config = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');
  assert.match(config, /run_worker_first\s*=\s*\["\/api\/\*"\]/);
  assert.match(config, /PREVIEW_ONLY\s*=\s*"true"/);
});
