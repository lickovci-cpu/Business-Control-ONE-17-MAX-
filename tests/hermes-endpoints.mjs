import assert from 'node:assert/strict';
const leads=(await import('../api/internal/hermes/leads.js')).default;
const prospects=(await import('../api/internal/hermes/prospects.js')).default;
const response=()=>{let code=200,payload=null;return{status(n){code=n;return this;},json(v){payload=v;return this;},get result(){return{code,payload};}};};

process.env.HERMES_BCO_READ_TOKEN='test-read-token';
process.env.HERMES_BCO_WRITE_TOKEN='test-write-token';
process.env.HERMES_BCO_INGEST_ENABLED='false';
delete process.env.SUPABASE_SECRET_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_KEY;

let res=response();
await leads({method:'GET',headers:{},query:{}},res);
assert.equal(res.result.code,401);
res=response();
await leads({method:'GET',headers:{authorization:'Bearer wrong-token'},query:{}},res);
assert.equal(res.result.code,401);
res=response();
await leads({method:'GET',headers:{authorization:'Bearer test-read-token'},query:{organization:'ne-e-m',limit:'1'}},res);
assert.equal(res.result.code,503);
assert.equal(res.result.payload.error,'SERVER_DATABASE_CREDENTIAL_NOT_CONFIGURED');
res=response();
await prospects({method:'POST',headers:{authorization:'Bearer wrong-token'},body:{}},res);
assert.equal(res.result.code,401);
res=response();
await prospects({method:'POST',headers:{authorization:'Bearer test-write-token'},body:{organization:'ne-e-m'}},res);
assert.equal(res.result.code,200);
assert.equal(res.result.payload.disabled,true);
assert.equal(res.result.payload.reason,'INGEST_DISABLED');

process.env.SUPABASE_SECRET_KEY='mock-server-only-key';
process.env.HERMES_BCO_INGEST_ENABLED='true';
const originalFetch=global.fetch;
const org={id:'d2751286-da99-42c0-b8ac-6a2da8ecdabf',name:'NŘŠM',slug:'ne-e-m'};
const fakeProspects=[];
const calls=[];
global.fetch=async(url,opt={})=>{
  const u=new URL(String(url)),method=String(opt.method||'GET').toUpperCase();
  calls.push({url:u.toString(),method});
  let result=[];
  if(u.pathname.endsWith('/organizations'))result=[org];
  else if(u.pathname.endsWith('/leads'))result=[];
  else if(u.pathname.endsWith('/merch_prospects')){
    if(method==='GET'){
      const domain=u.searchParams.get('domain')?.replace(/^eq\./,'');
      result=fakeProspects.filter(x=>!domain||x.domain===domain);
    }else if(method==='POST'){
      const row=JSON.parse(opt.body);
      const created={id:'mock-prospect-1',...row};
      fakeProspects.push(created);
      result=[created];
    }
  }
  return new Response(JSON.stringify(result),{status:200,headers:{'content-type':'application/json'}});
};

res=response();
await leads({method:'GET',headers:{authorization:'Bearer test-read-token'},query:{organization:'ne-e-m',limit:'5'}},res);
assert.equal(res.result.code,200);
assert.equal(res.result.payload.readOnly,true);
assert.equal(res.result.payload.organization.slug,'ne-e-m');
assert.equal(calls.every(x=>x.method==='GET'),true,'Hermes read-only route must never write.');

const testProspect={organization:'ne-e-m',company_name:'TEST ONLY – Hermes preview fixture',domain:'test-sound.example',contact_name:'Fixture Contact',email:'fixture@test-sound.example',source:'unit-test-fixture',source_url:'https://example.test/request/fixture-1',observed_at:new Date().toISOString(),source_verified:true,fit_score:50,notes:'Synthetic local fixture; not a real lead.'};
res=response();
await prospects({method:'POST',headers:{authorization:'Bearer test-write-token'},body:testProspect},res);
assert.equal(res.result.code,201);
assert.equal(res.result.payload.created.status,'discovered');
assert.equal(res.result.payload.created.metadata.outreach_eligible,false);
assert.equal(res.result.payload.created.metadata.legal_basis,'unknown');
assert.equal(res.result.payload.send_authorized,false);
assert.equal(fakeProspects.length,1);

res=response();
await prospects({method:'POST',headers:{authorization:'Bearer test-write-token'},body:testProspect},res);
assert.equal(res.result.code,200);
assert.equal(res.result.payload.duplicate,true);
assert.equal(fakeProspects.length,1,'Retry must not create a duplicate');

res=response();
await prospects({method:'POST',headers:{authorization:'Bearer test-write-token'},body:{...testProspect,source_url:'http://example.test/request/fixture-2'}},res);
assert.equal(res.result.code,400);
assert.equal(res.result.payload.error,'HTTPS_SOURCE_REQUIRED');

global.fetch=originalFetch;
console.log('HERMES API TESTS PASSED — read-only fetch, guarded one-record mock ingest, no duplicate, no send authorization, HTTP source rejection.');
