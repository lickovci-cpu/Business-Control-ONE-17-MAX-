import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../worker.js';

const assets = { fetch: async () => new Response('STATIC OK', { status: 200 }) };
test('health is preview-only and reports backend disconnected', async () => {
  const r=await worker.fetch(new Request('https://preview.invalid/api/health'),{ASSETS:assets});
  assert.equal(r.status,200); assert.equal((await r.json()).backend,'not-connected');
});
test('API writes fail closed', async () => {
  const r=await worker.fetch(new Request('https://preview.invalid/api/upload',{method:'POST'}),{ASSETS:assets});
  assert.equal(r.status,503); assert.equal((await r.json()).error,'PREVIEW_BACKEND_NOT_CONNECTED');
});
test('static response is noindex, nosniff and blocks external connections', async () => {
  const r=await worker.fetch(new Request('https://preview.invalid/'),{ASSETS:assets});
  assert.equal(r.status,200);
  assert.match(r.headers.get('x-robots-tag'),/noindex/);
  assert.equal(r.headers.get('x-content-type-options'),'nosniff');
  assert.equal(r.headers.get('content-security-policy'),"connect-src 'self'; form-action 'self'; worker-src 'none'");
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
