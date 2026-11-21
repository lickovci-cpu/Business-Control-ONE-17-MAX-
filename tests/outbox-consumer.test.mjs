import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/integrations/outbox-consumer.js';

const ID='11111111-1111-4111-8111-111111111111';
const ORG='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LOCK='22222222-2222-4222-8222-222222222222';
const BASE='https://bco-test.supabase.co';
const ROW={id:ID,organization_id:ORG,dedupe_key:ORG+':stripe:evt_1',event_type:'invoice.paid',payload:{invoice:'inv_1'},lock_token:LOCK,attempts:1};
function req(method='POST',authorization='Bearer cron-secret'){return {method,headers:{authorization}};}
function res(){return {headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};}
function setup({sinkStatus=200,complete=true,failState='retry',claim=[ROW]}={}){
  process.env.SUPABASE_URL=BASE;process.env.SUPABASE_SERVICE_ROLE_KEY='service-role-local-only';process.env.CRON_SECRET='cron-secret';process.env.BCO_INTEGRATION_OUTBOX_ENABLED='true';process.env.BCO_OUTBOX_SINK_URL='https://sink.example.test/bco';process.env.BCO_OUTBOX_SINK_SECRET='sink-secret';process.env.BCO_OUTBOX_BATCH_SIZE='20';
  const calls=[];
  globalThis.fetch=async(url,options={})=>{
    const u=String(url);calls.push({url:u,options});
    if(u===BASE+'/rest/v1/rpc/claim_integration_outbox')return new Response(JSON.stringify(claim),{status:200});
    if(u===BASE+'/rest/v1/rpc/complete_integration_outbox')return new Response(JSON.stringify(complete),{status:200});
    if(u===BASE+'/rest/v1/rpc/fail_integration_outbox')return new Response(JSON.stringify(failState),{status:200});
    if(u==='https://sink.example.test/bco')return new Response('',{status:sinkStatus});
    throw new Error('Unexpected URL '+u);
  };
  return calls;
}

test('outbox relay claims with service role, forwards scoped idempotency key, then completes with lease token',async()=>{
  const calls=setup(),response=res();await handler(req(),response);
  assert.equal(response.statusCode,200);assert.deepEqual(response.body,{ok:true,claimed:1,processed:1,retried:0,dead:0,stale:0,invalid:0});
  const claim=calls.find(x=>x.url.endsWith('/claim_integration_outbox'));
  assert.equal(claim.options.headers.Authorization,'Bearer service-role-local-only');
  assert.equal(JSON.parse(claim.options.body).p_limit,20);
  const sink=calls.find(x=>x.url==='https://sink.example.test/bco');
  assert.equal(sink.options.headers.Authorization,'Bearer sink-secret');
  assert.equal(sink.options.headers['Idempotency-Key'],ROW.organization_id+':'+ROW.dedupe_key);
  const complete=calls.find(x=>x.url.endsWith('/complete_integration_outbox'));
  assert.deepEqual(JSON.parse(complete.options.body),{p_id:ID,p_lock_token:LOCK});
});

test('failed sink delivery calls lease-token guarded retry RPC',async()=>{
  const calls=setup({sinkStatus:503,failState:'retry'}),response=res();await handler(req(),response);
  assert.equal(response.statusCode,200);assert.equal(response.body.retried,1);assert.equal(response.body.processed,0);assert.equal(response.body.ok,false,'retry means this batch was not fully delivered');
  const fail=calls.find(x=>x.url.endsWith('/fail_integration_outbox'));
  assert.deepEqual(JSON.parse(fail.options.body),{p_id:ID,p_lock_token:LOCK,p_error:'OUTBOX_SINK_HTTP_503',p_retryable:true});
});

test('stale lease completion is not counted as processed',async()=>{
  const calls=setup({complete:false}),response=res();await handler(req(),response);
  assert.equal(response.body.processed,0);assert.equal(response.body.stale,1);assert.equal(response.body.ok,false);
});

test('disabled consumer and invalid cron secret fail closed before claiming',async()=>{
  const calls=setup();process.env.BCO_INTEGRATION_OUTBOX_ENABLED='false';let response=res();await handler(req(),response);
  assert.equal(response.statusCode,200);assert.equal(response.body.disabled,true);
  process.env.BCO_INTEGRATION_OUTBOX_ENABLED='true';response=res();await handler(req('POST','Bearer wrong'),response);
  assert.equal(response.statusCode,401);assert.equal(calls.length,0);
});

test('consumer refuses to claim when sink configuration is missing',async()=>{
  const calls=setup();delete process.env.BCO_OUTBOX_SINK_SECRET;const response=res();await handler(req(),response);
  assert.equal(response.statusCode,503);assert.equal(calls.length,0);
});

test('invalid claimed rows are failed with the current lease token rather than stranded processing',async()=>{
  const bad={...ROW,payload:null};const calls=setup({claim:[bad],failState:'dead'}),response=res();await handler(req(),response);
  assert.equal(response.body.invalid,1);assert.equal(response.body.dead,1);
  const fail=calls.find(x=>x.url.endsWith('/fail_integration_outbox'));
  assert.deepEqual(JSON.parse(fail.options.body),{p_id:ID,p_lock_token:LOCK,p_error:'INVALID_OUTBOX_EVENT_SHAPE',p_retryable:false});
});


test('final sink failure is reported as a dead-letter outcome, never success',async()=>{
  const calls=setup({sinkStatus:400,failState:'dead'}),response=res();await handler(req(),response);
  assert.equal(response.statusCode,200);assert.equal(response.body.dead,1);assert.equal(response.body.ok,false);
  const fail=calls.find(x=>x.url.endsWith('/fail_integration_outbox'));
  assert.deepEqual(JSON.parse(fail.options.body),{p_id:ID,p_lock_token:LOCK,p_error:'OUTBOX_SINK_HTTP_400',p_retryable:false});
  assert.equal(calls.some(x=>x.url.endsWith('/complete_integration_outbox')),false);
});
