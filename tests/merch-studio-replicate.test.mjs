import test from 'node:test';
import assert from 'node:assert/strict';

const BASE='https://bco-replicate-test.supabase.co';
const USER='11111111-1111-4111-8111-111111111111';
const ORG='d2751286-da99-42c0-b8ac-6a2da8ecdabf';
const TOKEN='merch-admin-jwt';
process.env.SUPABASE_URL=BASE;
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_replicate_test';
process.env.SUPABASE_SERVICE_ROLE_KEY='service-role-test-only';
process.env.BCO_ALLOW_PAID_MERCH_APIS='true';
process.env.REPLICATE_API_TOKEN='replicate-test-token';
process.env.REPLICATE_IMAGE_MODEL='black-forest-labs/flux-1.1-pro';
process.env.MERCH_CREATIVE_PROVIDERS='replicate';
const {default:handler}=await import('../api/merch-studio.js');
function response(){return {statusCode:200,body:null,status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};}

test('Replicate async generation polls safely and saves all five creative variants',async()=>{
  const calls=[];let prediction=0;
  globalThis.fetch=async(input,options={})=>{
    const url=String(input);calls.push({url,options});
    if(url===BASE+'/auth/v1/user')return new Response(JSON.stringify({id:USER}),{status:200});
    if(url.startsWith(BASE+'/rest/v1/memberships?'))return new Response(JSON.stringify([{organization_id:ORG,user_id:USER,role:'owner'}]),{status:200});
    if(url.startsWith('https://api.replicate.com/v1/models/')){
      prediction++;
      return new Response(JSON.stringify({id:'prediction-'+prediction,status:'starting',output:null}),{status:200});
    }
    if(url.startsWith('https://api.replicate.com/v1/predictions/')){
      return new Response(JSON.stringify({id:url.split('/').pop(),status:'succeeded',output:'https://images.example.test/'+url.split('/').pop()+'.webp'}),{status:200});
    }
    if(url===BASE+'/rest/v1/merch_creative_proposals'){
      const rows=JSON.parse(options.body);assert.equal(rows.length,5);
      assert.ok(rows.every(row=>row.organization_id===ORG&&row.status==='candidate'));
      return new Response(JSON.stringify(rows.map((row,index)=>({...row,id:'creative-'+index}))),{status:201});
    }
    throw new Error('Unexpected fetch '+url);
  };
  const res=response();
  await handler({method:'POST',headers:{authorization:'Bearer '+TOKEN},query:{action:'creative-batch'},body:{product_name:'NŘŠM hoodie',collection:'CORE'}},res);
  assert.equal(res.statusCode,201);assert.equal(res.body.creatives.length,5);assert.equal(res.body.previews.length,5);
  assert.ok(res.body.previews.every(x=>x.image_url.startsWith('https://images.example.test/')));
  assert.equal(calls.filter(x=>x.url.startsWith('https://api.replicate.com/v1/models/')).length,5);
  assert.equal(calls.filter(x=>x.url.startsWith('https://api.replicate.com/v1/predictions/')).length,5);
});
