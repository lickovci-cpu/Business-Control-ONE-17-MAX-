import assert from 'node:assert/strict';

process.env.NODE_ENV='production';
process.env.APP_PASSWORD='test-password';
process.env.SUPABASE_SERVICE_ROLE_KEY='bad–unicode-key';
process.env.SUPABASE_SERVICE_KEY='valid-ascii-key';

const realFetch=global.fetch;
global.fetch=async(url,opt={})=>{
  const u=String(url);
  assert.ok(u.includes('/rest/v1/leads?organization_id=eq.09fb6fc9-7ea9-46ac-a84b-bd9952784c0c'));
  assert.equal(opt.headers.apikey,'valid-ascii-key');
  assert.equal(opt.headers.Authorization,'Bearer valid-ascii-key');
  return new Response('[]',{status:200,headers:{'content-type':'application/json'}});
};

const {default:handler}=await import('../api/leads.js');

let value,statusCode=200;
const res={
  status(n){statusCode=n;return this;},
  json(v){value=v;return v;}
};

await handler({
  method:'GET',
  headers:{'x-app-key':'test-password'},
  query:{project:'jihoceske'}
},res);

assert.equal(statusCode,200);
assert.equal(value.verified,true);
assert.deepEqual(value.leads,[]);

console.log('CRM SUPABASE KEY ROUTING OK — invalid primary key falls back to valid secondary key.');

global.fetch=realFetch;
