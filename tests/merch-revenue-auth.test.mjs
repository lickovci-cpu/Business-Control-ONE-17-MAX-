import test from 'node:test';
import assert from 'node:assert/strict';

const BASE='https://bco-revenue-test.supabase.co';
const KV='https://bco-kv.test';
const ORG='d2751286-da99-42c0-b8ac-6a2da8ecdabf';
const USER='11111111-1111-4111-8111-111111111111';
const TOKEN='merch-user-jwt';
process.env.SUPABASE_URL=BASE;
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_revenue_test';
process.env.SUPABASE_SERVICE_ROLE_KEY='service-role-must-not-bypass-rls';
process.env.KV_REST_API_URL=KV;
process.env.KV_REST_API_TOKEN='kv-test-token';
process.env.CRON_SECRET='revenue-cron-secret';
process.env.BCO_ALLOW_PAID_MERCH_APIS='false';
const {default:handler}=await import('../api/merch-revenue.js');
function response(){return {statusCode:200,body:null,status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};}
function mock(){
  const calls=[];
  globalThis.fetch=async(input,options={})=>{
    const url=String(input);calls.push({url,options});
    if(url===BASE+'/auth/v1/user')return new Response(JSON.stringify({id:USER}),{status:200});
    if(url.startsWith(BASE+'/rest/v1/memberships?'))return new Response(JSON.stringify([{organization_id:ORG,user_id:USER,role:'worker'}]),{status:200});
    if(url.startsWith(BASE+'/rest/v1/'))return new Response('[]',{status:200});
    if(url===KV){const command=JSON.parse(options.body);return new Response(JSON.stringify({result:command[0]==='GET'?null:'OK'}),{status:200});}
    throw new Error('Unexpected fetch '+url);
  };
  return calls;
}

test('merch revenue user requests use caller JWT and keep RLS active even when service key exists',async()=>{
  const calls=mock(),res=response();
  await handler({method:'POST',headers:{authorization:'Bearer '+TOKEN}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.ok,true);
  const reads=calls.filter(x=>x.url.startsWith(BASE+'/rest/v1/')&&!x.url.includes('/memberships?'));
  assert.equal(reads.length,4);
  assert.ok(reads.every(x=>x.options.headers.apikey==='sb_publishable_revenue_test'));
  assert.ok(reads.every(x=>x.options.headers.Authorization==='Bearer '+TOKEN));
});

test('merch revenue cron is the only path allowed to use the service role',async()=>{
  const calls=mock(),res=response();
  await handler({method:'POST',headers:{authorization:'Bearer revenue-cron-secret'}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.ok,true);
  const reads=calls.filter(x=>x.url.startsWith(BASE+'/rest/v1/'));
  assert.equal(reads.length,4);
  assert.ok(reads.every(x=>x.options.headers.apikey==='service-role-must-not-bypass-rls'));
  assert.ok(reads.every(x=>x.options.headers.Authorization==='Bearer service-role-must-not-bypass-rls'));
  assert.equal(calls.some(x=>x.url===BASE+'/auth/v1/user'),false);
});
