import test from 'node:test';
import assert from 'node:assert/strict';
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
test('static response is noindex and nosniff', async () => {
  const r=await worker.fetch(new Request('https://preview.invalid/'),{ASSETS:assets});
  assert.equal(r.status,200); assert.match(r.headers.get('x-robots-tag'),/noindex/); assert.equal(r.headers.get('x-content-type-options'),'nosniff');
});
test('writes outside API are rejected', async () => {
  const r=await worker.fetch(new Request('https://preview.invalid/',{method:'POST'}),{ASSETS:assets}); assert.equal(r.status,405);
});
