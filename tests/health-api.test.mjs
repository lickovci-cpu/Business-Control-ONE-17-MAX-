import test from 'node:test';
import assert from 'node:assert/strict';

const BASE='https://bco-health-test.supabase.co';
const USER='11111111-1111-4111-8111-111111111111';
const MERCH='d2751286-da99-42c0-b8ac-6a2da8ecdabf';
const JIHOCESKE='09fb6fc9-7ea9-46ac-a84b-bd9952784c0c';
process.env.SUPABASE_URL=BASE;
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_health_test';
process.env.SUPABASE_SECRET_KEY='sb_secret_health_test';
process.env.BCO_PRIVATE_STORAGE_ENABLED='false';
process.env.CRON_SECRET='health-cron-secret';
process.env.AI_ALLOW_PAID_PROVIDERS='false';
process.env.AI_ALLOW_PAID_FALLBACKS='false';
delete process.env.SUPABASE_SNAPSHOT_BUCKET;
delete process.env.KV_REST_API_URL;
delete process.env.BLOB_READ_WRITE_TOKEN;
const {default:handler}=await import('../api/health.js');
function response(){return {statusCode:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};}
let memberships=[{organization_id:MERCH,user_id:USER,role:'owner'}];
const calls=[];
globalThis.fetch=async(input,options={})=>{
  const url=String(input);calls.push(url);
  if(url===BASE+'/auth/v1/user')return new Response(JSON.stringify({id:USER}),{status:200});
  if(url.startsWith(BASE+'/rest/v1/memberships?')){
    const query=new URL(url),org=query.searchParams.get('organization_id')?.slice(3),uid=query.searchParams.get('user_id')?.slice(3);
    return new Response(JSON.stringify(memberships.filter(x=>x.organization_id===org&&x.user_id===uid)),{status:200});
  }
  throw new Error('Unexpected health fetch '+url);
};

test('health follows the active project and reports real storage/paid status without false success',async()=>{
  const res=response();
  await handler({method:'GET',headers:{authorization:'Bearer health-user-jwt'},query:{project:'merch'}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.project,'merch');
  assert.equal(res.body.supabase.privateStorageEnabled,false);
  assert.equal(res.body.supabase.snapshotDestinationConfigured,false);
  assert.equal(res.body.supabase.automaticBackups,false);
  assert.equal(res.body.supabase.serverKeyConfigured,true);
  assert.equal(res.body.legacyPublicUploadEnabled,false);
  assert.equal(res.body.ai.paidProvidersEnabled,false);assert.equal(res.body.ai.paidFallbacks,false);assert.equal(res.body.ai.geminiFreeTierEnabled,false);
  assert.deepEqual(Object.keys(res.body.metaProjects),['merch'],'health must not disclose Meta configuration for other organizations');
  assert.equal(res.headers['Cache-Control'],'no-store');
});

test('health rejects an organization outside the verified user membership',async()=>{
  const before=calls.length,res=response();
  await handler({method:'GET',headers:{authorization:'Bearer health-user-jwt'},query:{project:'jihoceske'}},res);
  assert.equal(res.statusCode,401);assert.equal(calls.length,before+2);
});

test('health rejects unknown project keys',async()=>{
  const before=calls.length,res=response();
  await handler({method:'GET',headers:{authorization:'Bearer health-user-jwt'},query:{project:'unknown'}},res);
  assert.equal(res.statusCode,400);assert.equal(calls.length,before);
});
