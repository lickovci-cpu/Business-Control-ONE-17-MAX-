import test from 'node:test';
import assert from 'node:assert/strict';
import {authOrCloud,cloudMember,cloudAdmin,cloudIdentityForProject} from '../api/_cloud-auth.js';

const ORG='d2751286-da99-42c0-b8ac-6a2da8ecdabf';
const USER='11111111-1111-4111-8111-111111111111';
const TOKEN='verified-cloud-user-jwt';
const BASE='https://bco-test.supabase.co';
process.env.SUPABASE_URL=BASE;
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_auth_guard_test';
process.env.BCO_ALLOW_LEGACY_SHARED_SESSION='false';
function mockFetch(role='worker',member=true){
  globalThis.fetch=async(input,options={})=>{
    const url=String(input);
    if(url===BASE+'/auth/v1/user')return new Response(JSON.stringify({id:USER}),{status:200});
    if(url.startsWith(BASE+'/rest/v1/memberships?')){
      const u=new URL(url);const org=u.searchParams.get('organization_id')?.slice(3);const user=u.searchParams.get('user_id')?.slice(3);
      return new Response(JSON.stringify(member&&org===ORG&&user===USER?[{organization_id:ORG,user_id:USER,role}]:[]),{status:200});
    }
    throw new Error('Unexpected fetch '+url);
  };
}
const request=(authorization)=>({headers:authorization?{authorization}: {}});

test('organization APIs reject shared-session-only access by default',async()=>{
  process.env.BCO_ALLOW_LEGACY_SHARED_SESSION='false';
  assert.equal(await authOrCloud(request(undefined),'merch'),false);
});

test('valid Supabase JWT is bound to the configured organization membership',async()=>{
  mockFetch('worker',true);
  assert.equal(await cloudMember(request('Bearer '+TOKEN),'merch'),true);
  assert.equal(await authOrCloud(request('Bearer '+TOKEN),'merch'),true);
});

test('a valid JWT without membership is denied even if legacy fallback is enabled',async()=>{
  mockFetch('worker',false);process.env.BCO_ALLOW_LEGACY_SHARED_SESSION='true';
  assert.equal(await authOrCloud(request('Bearer '+TOKEN),'merch'),false);
  process.env.BCO_ALLOW_LEGACY_SHARED_SESSION='false';
});

test('administrative routes require owner/admin role rather than any membership',async()=>{
  mockFetch('worker',true);assert.equal(await cloudAdmin(request('Bearer '+TOKEN),'merch'),false);
  mockFetch('owner',true);assert.equal(await cloudAdmin(request('Bearer '+TOKEN),'merch'),true);
});

test('identity response exposes verified UID and role but rejects unknown project mapping',async()=>{
  mockFetch('manager',true);
  const identity=await cloudIdentityForProject(request('Bearer '+TOKEN),'merch');
  assert.equal(identity.ok,true);assert.equal(identity.userId,USER);assert.equal(identity.organizationId,ORG);assert.equal(identity.role,'manager');
  const unknown=await cloudIdentityForProject(request('Bearer '+TOKEN),'unknown');assert.equal(unknown.ok,false);assert.equal(unknown.status,400);
});
