import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import worker from '../workers/bco-automation/src/index.js';

const env={
  SUPABASE_URL:'https://pflfbphulvutccvvhrot.supabase.co',
  SUPABASE_PROJECT_REF:'pflfbphulvutccvvhrot',
  BCO_PRODUCTION_PROJECT_REF:'vjzzvopwecmwuccdidzq',
  SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_public_key_for_unit_tests',
  SUPABASE_SERVICE_ROLE_KEY:'not-used-by-api-tests',
  AUTOMATION_EXECUTOR_URL:'https://pflfbphulvutccvvhrot.supabase.co/functions/v1/automation-executor',
  AUTOMATION_EXECUTOR_TOKEN:'not-used-by-fetch-tests',
  ASSETS:{fetch:async request=>new Response('asset:'+new URL(request.url).pathname,{status:200})}
};
const originalFetch=globalThis.fetch;
let calls=[];
globalThis.fetch=async (input,init={})=>{
  const url=String(input);calls.push({url,init});
  if(url.endsWith('/auth/v1/user')){
    if(init.headers.authorization==='Bearer valid-staging-user-token')return new Response(JSON.stringify({id:'user-staging-1'}),{status:200,headers:{'content-type':'application/json'}});
    return new Response(JSON.stringify({message:'invalid token'}),{status:401,headers:{'content-type':'application/json'}});
  }
  if(url.includes('/functions/v1/bco-command-center')){
    return new Response(JSON.stringify({ok:true,organization_id:'org-staging',proposals:[],status:'approved'}),{status:200,headers:{'content-type':'application/json'}});
  }
  throw new Error('Unexpected upstream '+url);
};
try{
  const wrangler=JSON.parse(await readFile(new URL('../workers/bco-automation/wrangler.jsonc',import.meta.url),'utf8'));
  const workerSource=await readFile(new URL('../workers/bco-automation/src/index.js',import.meta.url),'utf8');
  const sw=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const manifest=JSON.parse(await readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
  assert.ok(sw.includes("bc17-1-cloudflare-staging-v1"));
  assert.ok(app.includes("https://pflfbphulvutccvvhrot.supabase.co"));
  assert.ok(!app.includes("vjzzvopwecmwuccdidzq"));
  assert.ok(!app.includes("sb_publishable_XAa2FyYnSZE9_3iZrbhD3g_F3mn-wI5"));
  assert.ok(html.includes('id="loginEmail"'));
  assert.equal(manifest.name,"Business Control ONE 17 MAX");
  assert.deepEqual(wrangler.triggers.crons,['*/5 * * * *']);
  assert.equal(wrangler.assets.directory,'../../public');
  assert.equal(wrangler.assets.binding,'ASSETS');
  assert.ok(workerSource.includes('async scheduled(event, env, ctx)'));
  assert.ok(!workerSource.includes('raw.githubusercontent.com'));
  assert.ok(sw.includes("url.pathname.startsWith('/api/')"));
  assert.ok(sw.includes("caches.match('/')"));
  const health=await worker.fetch(new Request('https://bco-preview.example/api/health'),env);
  assert.equal(health.status,200);
  const healthJson=await health.json();
  assert.equal(healthJson.version,'17-max');
  assert.equal(healthJson.backend,'staging-only');

  const noSession=await worker.fetch(new Request('https://bco-preview.example/api/session'),env);
  assert.equal(noSession.status,401);
  const session=await worker.fetch(new Request('https://bco-preview.example/api/session',{headers:{Authorization:'Bearer valid-staging-user-token'}}),env);
  assert.equal(session.status,200);
  assert.equal((await session.json()).authenticated,true);

  const proposals=await worker.fetch(new Request('https://bco-preview.example/api/revenue?action=proposals',{headers:{Authorization:'Bearer valid-staging-user-token'}}),env);
  assert.equal(proposals.status,200);
  assert.equal((await proposals.json()).organization_id,'org-staging');
  const forwarded=calls.find(x=>x.url.includes('/functions/v1/bco-command-center'));
  assert.equal(forwarded.init.headers.authorization,'Bearer valid-staging-user-token');
  assert.equal(forwarded.init.headers.apikey,env.SUPABASE_PUBLISHABLE_KEY);
  assert.equal(forwarded.init.headers['x-service-role-key'],undefined);
  assert.equal(forwarded.init.headers.origin,undefined);

  const approveNoAuth=await worker.fetch(new Request('https://bco-preview.example/api/revenue?action=approve_proposal',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({proposal_id:'00000000-0000-4000-8000-000000000001'})}),env);
  assert.equal(approveNoAuth.status,401);
  const approve=await worker.fetch(new Request('https://bco-preview.example/api/revenue?action=approve_proposal',{method:'POST',headers:{Authorization:'Bearer valid-staging-user-token','content-type':'application/json'},body:JSON.stringify({proposal_id:'00000000-0000-4000-8000-000000000001'})}),env);
  assert.equal(approve.status,200);

  const badAction=await worker.fetch(new Request('https://bco-preview.example/api/revenue?action=drop_database',{headers:{Authorization:'Bearer valid-staging-user-token'}}),env);
  assert.equal(badAction.status,400);
  const badMethod=await worker.fetch(new Request('https://bco-preview.example/api/revenue?action=proposals',{method:'POST',headers:{Authorization:'Bearer valid-staging-user-token','content-type':'application/json'},body:'{}'}),env);
  assert.equal(badMethod.status,405);
  const tooLarge=await worker.fetch(new Request('https://bco-preview.example/api/revenue?action=approve_proposal',{method:'POST',headers:{Authorization:'Bearer valid-staging-user-token','content-type':'application/json'},body:JSON.stringify({x:'a'.repeat(17000)})}),env);
  assert.equal(tooLarge.status,413);

  const legacy=await worker.fetch(new Request('https://bco-preview.example/api/ai'),env);
  assert.equal(legacy.status,501);
  const staticPage=await worker.fetch(new Request('https://bco-preview.example/'),env);
  assert.equal(staticPage.status,200);
  const rewrite=await worker.fetch(new Request('https://bco-preview.example/nrsm'),env);
  assert.equal(rewrite.status,200);
  const wrongOrigin=await worker.fetch(new Request('https://bco-preview.example/api/revenue?action=proposals',{headers:{Origin:'https://evil.example',Authorization:'Bearer valid-staging-user-token'}}),env);
  assert.equal(wrongOrigin.status,403);

  const wrongPortEnv={...env,SUPABASE_URL:'https://pflfbphulvutccvvhrot.supabase.co:8443'};
  const wrongPort=await worker.fetch(new Request('https://bco-preview.example/api/revenue?action=proposals',{headers:{Authorization:'Bearer valid-staging-user-token'}}),wrongPortEnv);
  assert.equal(wrongPort.status,503);
  const nonJson=await worker.fetch(new Request('https://bco-preview.example/api/revenue?action=approve_proposal',{method:'POST',headers:{Authorization:'Bearer valid-staging-user-token','content-type':'text/plain'},body:'{}'}),env);
  assert.equal(nonJson.status,415);

  const prodEnv={...env,SUPABASE_URL:'https://vjzzvopwecmwuccdidzq.supabase.co'};
  const prodGuard=await worker.fetch(new Request('https://bco-preview.example/api/revenue?action=proposals',{headers:{Authorization:'Bearer valid-staging-user-token'}}),prodEnv);
  assert.equal(prodGuard.status,503);

  console.log('CLOUDFLARE WORKER API OK — staging-only auth, session, revenue allowlist, origin guard, body limit, static assets and production-ref rejection.');
} finally {
  globalThis.fetch=originalFetch;
}
