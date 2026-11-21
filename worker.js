/*
 * BCO isolated preview Worker. All mutating/business API routes remain closed.
 * The real API adapter is intentionally not wired until auth parity and tests pass.
 */
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow, noarchive' },
});
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health' && request.method === 'GET') return json({ ok: true, service: 'bco-cloudflare-preview', preview: true, backend: 'not-connected' });
    if (url.pathname.startsWith('/api/')) return json({ ok: false, error: 'PREVIEW_BACKEND_NOT_CONNECTED', preview: true }, 503);
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('x-robots-tag', 'noindex, nofollow, noarchive');
    headers.set('x-content-type-options', 'nosniff');
    headers.set('referrer-policy', 'strict-origin-when-cross-origin');
    headers.set('cache-control', 'no-store');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
