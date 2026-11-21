import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/cloud-storage.js';

const ORG='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_ORG='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const JOB='33333333-3333-4333-8333-333333333333';
const USER='11111111-1111-4111-8111-111111111111';
const TOKEN='local-supabase-user-jwt';
const BASE='https://bco-test.supabase.co';

function request(method,url,{authorization,contentType='image/jpeg',contentLength,body=Buffer.from([0xff,0xd8,0xff,0xd9])}={}){
  const headers={host:'bco-preview.test','content-type':contentType};
  if(authorization)headers.authorization=authorization;
  if(contentLength!==undefined)headers['content-length']=String(contentLength);
  return {method,url,headers,async *[Symbol.asyncIterator](){if(method==='POST'&&body?.length)yield body;}};
}
function response(){return {headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(value){this.body=value;return this;}};}
function mockFetch({membership=true,storageStatus=201,signedURL='/object/sign/bco-media/test.jpg?token=short'}={}){
  const calls=[];
  globalThis.fetch=async(input,options={})=>{
    const url=String(input);calls.push({url,options});
    if(url===BASE+'/auth/v1/user'){
      if(options.headers?.Authorization!=='Bearer '+TOKEN)return new Response('{}',{status:401});
      return new Response(JSON.stringify({id:USER,email:'test@example.test'}),{status:200});
    }
    if(url.startsWith(BASE+'/rest/v1/memberships?')){
      const u=new URL(url);
      const org=u.searchParams.get('organization_id')?.slice(3);
      const user=u.searchParams.get('user_id')?.slice(3);
      return new Response(JSON.stringify(membership&&org===ORG&&user===USER?[{organization_id:ORG,user_id:USER,role:'worker'}]:[]),{status:200});
    }
    if(url.includes('/storage/v1/object/sign/')){
      if(storageStatus!==200)return new Response(JSON.stringify({message:'RLS denied'}),{status:storageStatus});
      return new Response(JSON.stringify({signedURL}),{status:200});
    }
    if(url.includes('/storage/v1/object/')){
      if(storageStatus!==201)return new Response(JSON.stringify({message:'RLS denied'}),{status:storageStatus});
      return new Response(JSON.stringify({Key:'stored'}),{status:201});
    }
    throw new Error('Unexpected fetch: '+url);
  };
  return calls;
}

process.env.SUPABASE_URL=BASE;
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_local_test_key';
process.env.BCO_PRIVATE_STORAGE_ENABLED='true';

test('private Storage is disabled unless the explicit server feature flag is enabled',async()=>{
  const prior=process.env.BCO_PRIVATE_STORAGE_ENABLED;delete process.env.BCO_PRIVATE_STORAGE_ENABLED;
  const calls=mockFetch();const res=response();
  await handler(request('POST',`/api/cloud-storage?organization_id=${ORG}`),res);
  assert.equal(res.statusCode,503);assert.equal(res.body.error,'PRIVATE_STORAGE_DISABLED');assert.equal(calls.length,0);
  process.env.BCO_PRIVATE_STORAGE_ENABLED=prior;
});

test('missing or forged Supabase JWT is rejected before Storage access',async()=>{
  const calls=mockFetch();let res=response();
  await handler(request('POST',`/api/cloud-storage?organization_id=${ORG}`),res);
  assert.equal(res.statusCode,401);assert.equal(calls.length,0);
  globalThis.fetch=async()=>new Response('{}',{status:401});res=response();
  await handler(request('POST',`/api/cloud-storage?organization_id=${ORG}`,{authorization:'Bearer forged.jwt'}),res);
  assert.equal(res.statusCode,401);
});

test('non-member cannot upload to another organization',async()=>{
  const calls=mockFetch({membership:false});const res=response();
  await handler(request('POST',`/api/cloud-storage?organization_id=${OTHER_ORG}`,{authorization:'Bearer '+TOKEN}),res);
  assert.equal(res.statusCode,403);assert.equal(res.body.error,'ORGANIZATION_MEMBERSHIP_REQUIRED');
  assert.equal(calls.some(x=>x.url.includes('/storage/v1/')),false);
});

test('member upload uses user JWT, server-generated path and forbids overwrite',async()=>{
  const calls=mockFetch();const res=response();
  await handler(request('POST',`/api/cloud-storage?organization_id=${ORG}&bucket=bco-media`,{authorization:'Bearer '+TOKEN}),res);
  assert.equal(res.statusCode,201);assert.equal(res.body.ok,true);assert.equal(res.body.organizationId,ORG);
  assert.match(res.body.path,new RegExp('^'+ORG+'/[0-9a-f-]{36}\\.jpg$','i'));
  const upload=calls.find(x=>x.url.includes('/storage/v1/object/bco-media/'));
  assert.ok(upload);assert.equal(upload.options.headers.Authorization,'Bearer '+TOKEN);assert.equal(upload.options.headers['x-upsert'],'false');
  assert.equal(upload.options.headers.apikey,'sb_publishable_local_test_key');
});

test('job-media path requires job id and Storage RLS remains the final assignment check',async()=>{
  const denied=mockFetch({storageStatus:400});let res=response();
  await handler(request('POST',`/api/cloud-storage?organization_id=${ORG}&bucket=job-media&job_id=${JOB}`,{authorization:'Bearer '+TOKEN}),res);
  assert.equal(res.statusCode,403);assert.equal(res.body.error,'STORAGE_REQUEST_FAILED');
  const calls=denied.filter(x=>x.url.includes('/storage/v1/object/'));
  assert.equal(calls.length,1);assert.ok(calls[0].url.includes(`/${ORG}/${JOB}/`));
  const noJob=mockFetch();res=response();
  await handler(request('POST',`/api/cloud-storage?organization_id=${ORG}&bucket=job-media`,{authorization:'Bearer '+TOKEN}),res);
  assert.equal(res.statusCode,400);assert.equal(res.body.error,'JOB_ID_REQUIRED');
});

test('upload rejects unsupported MIME and oversized files before Storage',async()=>{
  let calls=mockFetch();let res=response();
  await handler(request('POST',`/api/cloud-storage?organization_id=${ORG}`,{authorization:'Bearer '+TOKEN,contentType:'text/html'}),res);
  assert.equal(res.statusCode,415);assert.equal(calls.some(x=>x.url.includes('/storage/v1/')),false);
  calls=mockFetch();res=response();
  await handler(request('POST',`/api/cloud-storage?organization_id=${ORG}`,{authorization:'Bearer '+TOKEN,contentLength:4*1024*1024+1}),res);
  assert.equal(res.statusCode,413);assert.equal(calls.some(x=>x.url.includes('/storage/v1/')),false);
  calls=mockFetch();res=response();
  await handler(request('POST',`/api/cloud-storage?organization_id=${ORG}`,{authorization:'Bearer '+TOKEN,contentType:'image/jpeg',body:Buffer.from('<html>not an image</html>')}),res);
  assert.equal(res.statusCode,415);assert.equal(res.body.error,'FILE_SIGNATURE_MISMATCH');
  assert.equal(calls.some(x=>x.url.includes('/storage/v1/')),false);
});

test('download signs only an object inside the verified organization for 120 seconds',async()=>{
  const calls=mockFetch({storageStatus:200});const res=response();
  const path=`${ORG}/22222222-2222-4222-8222-222222222222.jpg`;
  await handler(request('GET',`/api/cloud-storage?organization_id=${ORG}&bucket=bco-media&path=${encodeURIComponent(path)}`,{authorization:'Bearer '+TOKEN}),res);
  assert.equal(res.statusCode,200);assert.equal(res.body.expiresIn,120);
  assert.equal(res.body.signedUrl,BASE+'/storage/v1/object/sign/bco-media/test.jpg?token=short');
  const sign=calls.find(x=>x.url.includes('/storage/v1/object/sign/'));
  assert.ok(sign);assert.equal(JSON.parse(sign.options.body).expiresIn,120);assert.equal(sign.options.headers.Authorization,'Bearer '+TOKEN);
  const outside=response();
  await handler(request('GET',`/api/cloud-storage?organization_id=${ORG}&bucket=bco-media&path=${encodeURIComponent(`${OTHER_ORG}/22222222-2222-4222-8222-222222222222.jpg`)}`,{authorization:'Bearer '+TOKEN}),outside);
  assert.equal(outside.statusCode,403);assert.equal(outside.body.error,'OBJECT_PATH_OUTSIDE_ORGANIZATION');
});

test('path traversal is rejected and no client-supplied object path is accepted on upload',async()=>{
  const calls=mockFetch();let res=response();
  await handler(request('GET',`/api/cloud-storage?organization_id=${ORG}&bucket=bco-media&path=${encodeURIComponent(`${ORG}/../secret.jpg`)}`,{authorization:'Bearer '+TOKEN}),res);
  assert.equal(res.statusCode,400);assert.equal(res.body.error,'INVALID_OBJECT_PATH');
  res=response();
  await handler(request('POST',`/api/cloud-storage?organization_id=${ORG}&bucket=bco-media&path=${encodeURIComponent(`${OTHER_ORG}/fake.jpg`)}`,{authorization:'Bearer '+TOKEN}),res);
  assert.equal(res.statusCode,201);assert.match(res.body.path,new RegExp('^'+ORG+'/'));
  assert.equal(calls.filter(x=>x.url.includes('/storage/v1/object/bco-media/')).length,1);
});
