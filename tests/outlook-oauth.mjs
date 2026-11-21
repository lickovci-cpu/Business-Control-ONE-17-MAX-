import assert from 'node:assert/strict';

process.env.OUTLOOK_CLIENT_ID='preview-client-id';
process.env.OUTLOOK_CLIENT_SECRET='preview-client-secret';
process.env.OUTLOOK_TENANT_ID='common';
process.env.OUTLOOK_REDIRECT_URI='https://preview.example.test/api/integrations/outlook/callback';
process.env.OUTLOOK_STATE_SECRET='test-state-secret';
process.env.OUTLOOK_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,7).toString('base64');

const outlook=await import('../api/_outlook.js');
const org='d2751286-da99-42c0-b8ac-6a2da8ecdabf';
const state=outlook.createOutlookState(org);
const payload=outlook.verifyOutlookState(state);
assert.equal(payload.organizationId,org);
assert.equal(typeof payload.nonce,'string');
const authorization=new URL(outlook.outlookAuthorizationUrl(state));
assert.equal(authorization.origin,'https://login.microsoftonline.com');
assert.equal(authorization.pathname,'/common/oauth2/v2.0/authorize');
assert.equal(authorization.searchParams.get('response_type'),'code');
assert.equal(authorization.searchParams.get('redirect_uri'),process.env.OUTLOOK_REDIRECT_URI);
const scopes=authorization.searchParams.get('scope').split(/\s+/);
for(const scope of ['Mail.Send','User.Read','offline_access','openid','profile'])assert.ok(scopes.includes(scope),'Missing OAuth scope: '+scope);
assert.throws(()=>outlook.verifyOutlookState(state+'x'),/OUTLOOK_STATE_INVALID/);
await assert.rejects(()=>outlook.storeOutlookAuthorization(org,{scope:'User.Read',refresh_token:'fake-refresh-token'}),/OUTLOOK_MAIL_SEND_PERMISSION_MISSING/);
console.log('OUTLOOK OAUTH URL, STATE INTEGRITY, SCOPE AND FAIL-CLOSED TOKEN STORAGE TESTS PASSED');


process.env.SUPABASE_URL='https://outlook-auth-test.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_outlook_test';
const user='11111111-1111-4111-8111-111111111111';
let role='worker';
const calls=[];
globalThis.fetch=async(input,options={})=>{
  const url=String(input);calls.push(url);
  if(url==='https://outlook-auth-test.supabase.co/auth/v1/user')return new Response(JSON.stringify({id:user}),{status:200});
  if(url.startsWith('https://outlook-auth-test.supabase.co/rest/v1/memberships?'))return new Response(JSON.stringify([{organization_id:org,user_id:user,role}]),{status:200});
  throw new Error('Outlook status should not access token storage in this test: '+url);
};
const {default:statusHandler}=await import('../api/integrations/outlook/status.js');
function response(){return {statusCode:200,body:null,status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};}
const workerRes=response();
await statusHandler({method:'GET',headers:{authorization:'Bearer outlook-user-jwt'},query:{organization_id:org}},workerRes);
assert.equal(workerRes.statusCode,401,'non-admin member must not read Outlook integration status');
assert.equal(calls.some(url=>url.includes('/rest/v1/integration_credentials')),false);
role='owner';
const otherOrgRes=response();
await statusHandler({method:'GET',headers:{authorization:'Bearer outlook-user-jwt'},query:{organization_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}},otherOrgRes);
assert.equal(otherOrgRes.statusCode,403,'admin may not request an unrelated organization ID');
assert.equal(calls.some(url=>url.includes('/rest/v1/integration_credentials')),false);
