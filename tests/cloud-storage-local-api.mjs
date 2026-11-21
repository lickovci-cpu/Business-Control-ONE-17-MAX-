import assert from 'node:assert/strict';
import handler from '../api/cloud-storage.js';
import {handlePrivateStorage} from '../workers/bco-private-storage.js';

const required=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','BCO_TEST_USER_A_JWT','BCO_TEST_USER_B_JWT','BCO_TEST_ORG_A','BCO_TEST_ORG_B','BCO_TEST_JOB_A','BCO_TEST_JOB_UNASSIGNED'];
for(const key of required)if(!process.env[key])throw new Error('Missing local test variable '+key);
process.env.BCO_PRIVATE_STORAGE_ENABLED='true';
const base=process.env.SUPABASE_URL.replace(/\/$/,'');
const tokenA=process.env.BCO_TEST_USER_A_JWT;
const tokenB=process.env.BCO_TEST_USER_B_JWT;
const orgA=process.env.BCO_TEST_ORG_A;
const orgB=process.env.BCO_TEST_ORG_B;
const jobA=process.env.BCO_TEST_JOB_A;
const jobUnassigned=process.env.BCO_TEST_JOB_UNASSIGNED;

function req(method,url,token,contentType,body){
  const headers={host:'127.0.0.1',authorization:'Bearer '+token};
  if(contentType)headers['content-type']=contentType;
  if(body)headers['content-length']=String(body.length);
  return {method,url,headers,async *[Symbol.asyncIterator](){if(method==='POST'&&body)yield body;}};
}
function res(){return {headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};}
async function invoke(request){const response=res();await handler(request,response);return response;}
const jpeg=Buffer.from([0xff,0xd8,0xff,0xd9]);

const own=await invoke(req('POST',`/api/cloud-storage?organization_id=${orgA}&bucket=bco-media`,tokenA,'image/jpeg',jpeg));
assert.equal(own.statusCode,201,JSON.stringify(own.body));
assert.equal(own.body.organizationId,orgA);
assert.match(own.body.path,new RegExp('^'+orgA+'/[0-9a-f-]{36}\\.jpg$','i'));
console.log('PASS: API verified real Supabase Auth UID + own organization membership and uploaded private object');

const signed=await invoke(req('GET',`/api/cloud-storage?organization_id=${orgA}&bucket=bco-media&path=${encodeURIComponent(own.body.path)}`,tokenA));
assert.equal(signed.statusCode,200,JSON.stringify(signed.body));
assert.equal(signed.body.expiresIn,120);
const downloaded=await fetch(signed.body.signedUrl,{cache:'no-store'});
assert.equal(downloaded.status,200,'signed download must work against local Supabase');
await downloaded.arrayBuffer();
console.log('PASS: API issued and verified a 120-second private download URL');

const cross=await invoke(req('POST',`/api/cloud-storage?organization_id=${orgB}&bucket=bco-media`,tokenA,'image/jpeg',jpeg));
assert.equal(cross.statusCode,403);
console.log('PASS: API denied cross-organization upload using the caller JWT');

const assigned=await invoke(req('POST',`/api/cloud-storage?organization_id=${orgA}&bucket=job-media&job_id=${jobA}`,tokenA,'application/pdf',Buffer.from('%PDF-1.7\n%%EOF')));
assert.equal(assigned.statusCode,201,JSON.stringify(assigned.body));
const unassigned=await invoke(req('POST',`/api/cloud-storage?organization_id=${orgA}&bucket=job-media&job_id=${jobUnassigned}`,tokenA,'application/pdf',Buffer.from('%PDF-1.7\n%%EOF')));
assert.equal(unassigned.statusCode,403,'Storage RLS must reject an unassigned job');
console.log('PASS: assigned job upload allowed; unassigned job denied by existing Storage RLS');

const forged=await invoke(req('POST',`/api/cloud-storage?organization_id=${orgA}&bucket=bco-media`,'forged.invalid.jwt','image/jpeg',jpeg));
assert.equal(forged.statusCode,401);
const userB=await invoke(req('POST',`/api/cloud-storage?organization_id=${orgB}&bucket=bco-media`,tokenB,'image/jpeg',jpeg));
assert.equal(userB.statusCode,201,JSON.stringify(userB.body));
console.log('PASS: forged JWT rejected; second organization user allowed only in own organization');

const workerEnv={BCO_PRIVATE_STORAGE_ENABLED:'true',SUPABASE_URL:base,SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY};
const workerUpload=await handlePrivateStorage(new Request(`${base}/api/cloud-storage?organization_id=${orgA}&bucket=bco-media`,{method:'POST',headers:{Authorization:'Bearer '+tokenA,'Content-Type':'image/jpeg'},body:jpeg}),workerEnv);
const workerObject=await workerUpload.json();
assert.equal(workerUpload.status,201,JSON.stringify(workerObject));
const workerDownload=await handlePrivateStorage(new Request(`${base}/api/cloud-storage?organization_id=${orgA}&bucket=bco-media&path=${encodeURIComponent(workerObject.path)}`,{headers:{Authorization:'Bearer '+tokenA}}),workerEnv);
const workerSigned=await workerDownload.json();
assert.equal(workerDownload.status,200,JSON.stringify(workerSigned));assert.equal(workerSigned.expiresIn,120);
const workerFile=await fetch(workerSigned.signedUrl,{cache:'no-store'});assert.equal(workerFile.status,200);await workerFile.arrayBuffer();
console.log('PASS: Cloudflare Worker handler verified local JWT, RLS upload and signed download');
console.log('PASS: local Supabase Auth + RLS integration for Vercel and Cloudflare Storage adapters');
