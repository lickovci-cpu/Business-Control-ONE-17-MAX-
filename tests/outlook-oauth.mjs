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
