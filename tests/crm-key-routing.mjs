import assert from 'node:assert/strict';

process.env.NODE_ENV='production';
process.env.APP_PASSWORD='test-password';
process.env.SUPABASE_URL='https://bco-auth-test.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test_key';
process.env.SUPABASE_SERVICE_ROLE_KEY='bad–unicode-key';
process.env.SUPABASE_SERVICE_KEY='valid-ascii-key';
const USER='11111111-1111-4111-8111-111111111111';
const ORG='09fb6fc9-7ea9-46ac-a84b-bd9952784c0c';

const {supabaseServiceKey}=await import('../api/_lib.js');
assert.equal(supabaseServiceKey(),'valid-ascii-key','server-only credential fallback should still work for system jobs');
process.env.SUPABASE_SECRET_KEY='sb_secret_modern_test_key';
assert.equal(supabaseServiceKey(),'sb_secret_modern_test_key','modern Supabase secret key must take precedence over legacy key names');
delete process.env.SUPABASE_SECRET_KEY;

const realFetch=global.fetch;
global.fetch=async(url,opt={})=>{
  const u=String(url);
  if(u==='https://bco-auth-test.supabase.co/auth/v1/user'){
    assert.equal(opt.headers.Authorization,'Bearer test-user-jwt');
    return new Response(JSON.stringify({id:USER}),{status:200});
  }
  if(u.startsWith('https://bco-auth-test.supabase.co/rest/v1/memberships?')){
    assert.equal(opt.headers.Authorization,'Bearer test-user-jwt');
    const query=new URL(u);
    assert.equal(query.searchParams.get('organization_id'),'eq.'+ORG);
    assert.equal(query.searchParams.get('user_id'),'eq.'+USER);
    return new Response(JSON.stringify([{organization_id:ORG,user_id:USER,role:'owner'}]),{status:200});
  }
  assert.ok(u.includes('/rest/v1/leads?organization_id=eq.'+ORG));
  assert.equal(opt.headers.apikey,'sb_publishable_test_key','user-scoped CRM must use publishable key');
  assert.equal(opt.headers.Authorization,'Bearer test-user-jwt','user-scoped CRM must never silently switch to service role');
  return new Response('[]',{status:200,headers:{'content-type':'application/json'}});
};

const {default:handler}=await import('../api/leads.js');
let value,statusCode=200;
const res={status(n){statusCode=n;return this;},json(v){value=v;return v;}};
await handler({method:'GET',headers:{authorization:'Bearer test-user-jwt'},query:{project:'jihoceske'}},res);
assert.equal(statusCode,200);
assert.equal(value.verified,true);
assert.deepEqual(value.leads,[]);

console.log('CRM USER-JWT ROUTING OK — verified identity, RLS-preserving caller JWT, and server-only key fallback remain separate.');
global.fetch=realFetch;
