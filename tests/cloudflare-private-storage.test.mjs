import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePrivateStorage} from '../workers/bco-private-storage.js';

const ORG='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER='11111111-1111-4111-8111-111111111111';
const JOB='33333333-3333-4333-8333-333333333333';
const TOKEN='worker-test-user-jwt';
const BASE='https://bco-test.supabase.co';
const env={BCO_PRIVATE_STORAGE_ENABLED:'true',SUPABASE_URL:BASE,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_worker_test'};
function mockFetch({membership=true,storageStatus=201,signedURL='/object/sign/bco-media/test.jpg?token=short'}={}){
  const calls=[];
  const fetcher=async(input,options={})=>{
    const url=String(input);calls.push({url,options});
    if(url===BASE+'/auth/v1/user')return new Response(JSON.stringify({id:USER}),{status:200});
    if(url.startsWith(BASE+'/rest/v1/memberships?')){
      const u=new URL(url);const org=u.searchParams.get('organization_id')?.slice(3);const user=u.searchParams.get('user_id')?.slice(3);
      return new Response(JSON.stringify(membership&&org===ORG&&user===USER?[{organization_id:ORG,user_id:USER,role:'worker'}]:[]),{status:200});
    }
    if(url.includes('/storage/v1/object/sign/'))return storageStatus===200?new Response(JSON.stringify({signedURL}),{status:200}):new Response(JSON.stringify({message:'RLS denied'}),{status:storageStatus});
    if(url.includes('/storage/v1/object/'))return storageStatus===201?new Response('{}',{status:201}):new Response(JSON.stringify({message:'RLS denied'}),{status:storageStatus});
    throw new Error('Unexpected URL '+url);
  };
  return {fetcher,calls};
}
function webRequest(method,url,{token=TOKEN,mime='image/jpeg',body=Buffer.from([0xff,0xd8,0xff,0xd9]),contentLength}={}){
  const headers={Authorization:'Bearer '+token};if(mime)headers['Content-Type']=mime;if(contentLength!==undefined)headers['Content-Length']=String(contentLength);
  return new Request(url,{method,headers,...(method==='POST'?{body}: {})});
}

test('Worker adapter stays disabled without an explicit server feature flag',async()=>{
  const {fetcher,calls}=mockFetch();const response=await handlePrivateStorage(webRequest('POST',`https://bco.example.test/api/cloud-storage?organization_id=${ORG}`),{...env,BCO_PRIVATE_STORAGE_ENABLED:'false'},fetcher);
  assert.equal(response.status,503);assert.equal(calls.length,0);
});

test('Worker adapter verifies JWT and organization membership before upload',async()=>{
  const {fetcher,calls}=mockFetch();
  const response=await handlePrivateStorage(webRequest('POST',`https://bco.example.test/api/cloud-storage?organization_id=${ORG}&bucket=bco-media`),env,fetcher);
  const body=await response.json();assert.equal(response.status,201);assert.equal(body.organizationId,ORG);
  assert.match(body.path,new RegExp('^'+ORG+'/[0-9a-f-]{36}\\.jpg$','i'));
  const storage=calls.find(x=>x.url.includes('/storage/v1/object/bco-media/'));
  assert.ok(storage);assert.equal(storage.options.headers.Authorization,'Bearer '+TOKEN);assert.equal(storage.options.headers['x-upsert'],'false');
});

test('Worker adapter rejects cross-organization, invalid signature and oversized upload',async()=>{
  let {fetcher,calls}=mockFetch({membership:false});
  let response=await handlePrivateStorage(webRequest('POST',`https://bco.example.test/api/cloud-storage?organization_id=${OTHER}`),env,fetcher);
  assert.equal(response.status,403);assert.equal(calls.some(x=>x.url.includes('/storage/v1/')),false);
  ({fetcher,calls}=mockFetch());
  response=await handlePrivateStorage(webRequest('POST',`https://bco.example.test/api/cloud-storage?organization_id=${ORG}`,{body:Buffer.from('<html>')}),env,fetcher);
  assert.equal(response.status,415);
  response=await handlePrivateStorage(webRequest('POST',`https://bco.example.test/api/cloud-storage?organization_id=${ORG}`,{contentLength:4*1024*1024+1}),env,fetcher);
  assert.equal(response.status,413);
});

test('Worker adapter returns a 120-second signed URL and validates organization path',async()=>{
  const {fetcher,calls}=mockFetch({storageStatus:200});
  const path=`${ORG}/22222222-2222-4222-8222-222222222222.jpg`;
  const response=await handlePrivateStorage(webRequest('GET',`https://bco.example.test/api/cloud-storage?organization_id=${ORG}&bucket=bco-media&path=${encodeURIComponent(path)}`),env,fetcher);
  const body=await response.json();assert.equal(response.status,200);assert.equal(body.expiresIn,120);
  assert.equal(body.signedUrl,BASE+'/storage/v1/object/sign/bco-media/test.jpg?token=short');
  assert.ok(calls.some(x=>x.url.includes('/storage/v1/object/sign/')));
  const outside=await handlePrivateStorage(webRequest('GET',`https://bco.example.test/api/cloud-storage?organization_id=${ORG}&bucket=bco-media&path=${encodeURIComponent(`${OTHER}/22222222-2222-4222-8222-222222222222.jpg`)}`),env,fetcher);
  assert.equal(outside.status,403);
});

test('Worker adapter leaves job assignment enforcement to the existing Storage RLS policy',async()=>{
  const {fetcher,calls}=mockFetch({storageStatus:400});
  const response=await handlePrivateStorage(webRequest('POST',`https://bco.example.test/api/cloud-storage?organization_id=${ORG}&bucket=job-media&job_id=${JOB}`,{mime:'application/pdf',body:Buffer.from('%PDF-1.7\n%%EOF')}),env,fetcher);
  assert.equal(response.status,403);
  assert.ok(calls.some(x=>x.url.includes(`/${ORG}/${JOB}/`)));
});
