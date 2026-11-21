import test from 'node:test';
import assert from 'node:assert/strict';

const BASE='https://bco-test.supabase.co';
const ORG='d2751286-da99-42c0-b8ac-6a2da8ecdabf';
const USER='11111111-1111-4111-8111-111111111111';
const TOKEN='commercial-user-jwt';
process.env.SUPABASE_URL=BASE;
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_commercial_test';
process.env.SUPABASE_SERVICE_ROLE_KEY='service-role-must-not-bypass-rls';
process.env.BCO_ALLOW_LEGACY_SHARED_SESSION='false';
const {default:handler}=await import('../api/commercial.js');
function response(){return {statusCode:200,body:null,status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};}
function mock({member=true}={}){
  const calls=[];
  globalThis.fetch=async(input,options={})=>{
    const url=String(input);calls.push({url,options});
    if(url===BASE+'/auth/v1/user')return new Response(JSON.stringify({id:USER}),{status:200});
    if(url.startsWith(BASE+'/rest/v1/memberships?'))return new Response(JSON.stringify(member?[{organization_id:ORG,user_id:USER,role:'owner'}]:[]),{status:200});
    if(url.startsWith(BASE+'/rest/v1/'))return new Response('[]',{status:200});
    throw new Error('Unexpected fetch '+url);
  };
  return calls;
}

test('commercial GET authenticates Supabase UID, applies organization membership and uses caller JWT for all four queries',async()=>{
  const calls=mock(),res=response();
  await handler({method:'GET',url:'/api/commercial?project=merch',query:{project:'merch'},headers:{authorization:'Bearer '+TOKEN}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.ok,true);assert.equal(res.body.organization_id,ORG);
  const reads=calls.filter(x=>x.url.startsWith(BASE+'/rest/v1/')&&!x.url.includes('/memberships?'));
  assert.equal(reads.length,4);
  assert.ok(reads.every(x=>x.options.headers.Authorization==='Bearer '+TOKEN));
  assert.ok(reads.every(x=>x.options.headers.apikey==='sb_publishable_commercial_test'),'commercial user requests must not use the configured service-role key');
  assert.ok(reads.every(x=>x.url.includes('organization_id=eq.'+ORG)));
});

test('commercial GET rejects missing JWT and cross-organization member before data queries',async()=>{
  const calls=mock(),missing=response();
  await handler({method:'GET',url:'/api/commercial',query:{project:'merch'},headers:{}},missing);
  assert.equal(missing.statusCode,401);assert.equal(calls.length,0);
  const deniedCalls=mock({member:false}),denied=response();
  await handler({method:'GET',url:'/api/commercial?project=merch',query:{project:'merch'},headers:{authorization:'Bearer '+TOKEN}},denied);
  assert.equal(denied.statusCode,401);
  assert.equal(deniedCalls.filter(x=>x.url.startsWith(BASE+'/rest/v1/')&&!x.url.includes('/memberships?')).length,0);
});
