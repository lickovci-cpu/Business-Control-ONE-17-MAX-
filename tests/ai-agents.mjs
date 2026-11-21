import assert from 'node:assert/strict';

process.env.APP_PASSWORD='test-password';
process.env.NODE_ENV='production';
process.env.OPENAI_API_KEY='test-openai-key';
process.env.AI_ALLOW_PAID_PROVIDERS='true';
process.env.GEMINI_API_KEY='';
process.env.ANTHROPIC_API_KEY='';
process.env.OPENROUTER_API_KEY='';
process.env.CUSTOM_AI_URL='';

const realFetch=global.fetch;
const TEST_USER='11111111-1111-4111-8111-111111111111';
const TEST_ORGS={jihoceske:'09fb6fc9-7ea9-46ac-a84b-bd9952784c0c',merch:'d2751286-da99-42c0-b8ac-6a2da8ecdabf'};
process.env.SUPABASE_URL='https://bco-auth-test.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test_key';
function mockSupabaseAuth(url,opt={}){
  if(url==='https://bco-auth-test.supabase.co/auth/v1/user'){
    assert.equal(opt.headers?.Authorization,'Bearer test-user-jwt');
    return new Response(JSON.stringify({id:TEST_USER}),{status:200});
  }
  if(url.startsWith('https://bco-auth-test.supabase.co/rest/v1/memberships?')){
    assert.equal(opt.headers?.Authorization,'Bearer test-user-jwt');
    const query=new URL(url);
    const org=query.searchParams.get('organization_id')?.slice(3);
    const user=query.searchParams.get('user_id')?.slice(3);
    return new Response(JSON.stringify(user===TEST_USER&&Object.values(TEST_ORGS).includes(org)?[{organization_id:org,user_id:user,role:'owner'}]:[]),{status:200});
  }
  return null;
}
global.fetch=async(url,opt={})=>{
  const u=String(url);
  if(u==='https://api.openai.com/v1/responses'){
    const body=JSON.parse(opt.body);
    assert.equal(body.model,'gpt-5.6-luna');
    assert.equal(body.input?.[0]?.role,'user');
    assert.ok(Array.isArray(body.input?.[0]?.content));
    return new Response(JSON.stringify({output_text:'{"ok":true,"source":"openai","intent":"test","project":"jihoceske","goal":"test","tasks":[],"notes":[]}'}),{status:200,headers:{'content-type':'application/json'}});
  }
  const authResponse=mockSupabaseAuth(u,opt);
  if(authResponse)return authResponse;
  return realFetch(url,opt);
};

function response(){
  let statusCode=200,value;
  return {status(n){statusCode=n;return this;},json(v){value=v;return v;},get statusCode(){return statusCode;},get value(){return value;}};
}

const ai=await import('../api/ai.js');

const res=response();
await ai.default({
  method:'POST',
  headers:{authorization:'Bearer test-user-jwt'},
  body:{task:'command',project:'jihoceske',agent:'ceo',prompt:'test',provider:'openai',context:{safe:true}}
},res);

assert.equal(res.statusCode,200);
assert.equal(res.value.provider,'openai');
assert.equal(res.value.model,'gpt-5.6-luna');
assert.equal(res.value.structuredExpected,true);
assert.equal(res.value.structuredValid,true);
assert.deepEqual(res.value.parsed,{ok:true,source:'openai',intent:'test',project:'jihoceske',goal:'test',tasks:[],notes:[]});
assert.deepEqual(res.value.attemptedProviders,['openai']);

global.fetch=async(url,opt={})=>{
  const u=String(url);
  if(u==='https://api.openai.com/v1/responses'){
    return new Response(JSON.stringify({output_text:JSON.stringify({
      fitReason:'B2B fit',
      priority:'A',
      subject:'NŘŠM merch',
      firstMessage:'Ahoj',
      whatsapp:'Ahoj',
      questions:['Kolik kusů?'],
      followUps:{d2:'Za 2 dny',d5:'Za 5 dní',d10:'Za 10 dní'},
      objections:[{objection:'Cena',answer:'Pošlu nabídku po potvrzení rozsahu.'}],
      nextStep:'Poslat podklady',
      crmNote:'Test'
    })}),{status:200,headers:{'content-type':'application/json'}});
  }
  const authResponse=mockSupabaseAuth(u,opt);
  if(authResponse)return authResponse;
  return realFetch(url,opt);
};
const leadkit=response();
await ai.default({
  method:'POST',
  headers:{authorization:'Bearer test-user-jwt'},
  body:{task:'leadkit',project:'merch',agent:'followup',prompt:'test',provider:'openai',context:{safe:true}}
},leadkit);
assert.equal(leadkit.statusCode,200);
assert.equal(leadkit.value.structuredValid,true);
assert.equal(leadkit.value.parsed.followUps.d5,'Za 5 dní');

process.env.OPENAI_API_KEY='';
process.env.AI_COST_MODE='free-first';
process.env.AI_ALLOW_PAID_FALLBACKS='false';

const auto=response();
await ai.default({
  method:'POST',
  headers:{authorization:'Bearer test-user-jwt'},
  body:{task:'command',project:'jihoceske',agent:'ceo',prompt:'test',provider:'auto',context:{safe:true}}
},auto);

assert.notEqual(auto.statusCode,200);
assert.equal(auto.statusCode,500);

process.env.OPENROUTER_API_KEY='test-openrouter-key';
process.env.OPENROUTER_MODEL='meta-llama/llama-3.3-70b-instruct:free';
process.env.AI_ALLOW_PAID_PROVIDERS='false';
global.fetch=async(url,opt={})=>{
  const u=String(url);
  if(u==='https://openrouter.ai/api/v1/chat/completions')return new Response(JSON.stringify({choices:[{message:{content:'{"ok":true,"source":"openrouter-free","intent":"test","project":"jihoceske","goal":"test","tasks":[],"notes":[]}'}}]}),{status:200,headers:{'content-type':'application/json'}});
  const authResponse=mockSupabaseAuth(u,opt);
  if(authResponse)return authResponse;
  return realFetch(url,opt);
};
const freeOpenRouter=response();
await ai.default({method:'POST',headers:{authorization:'Bearer test-user-jwt'},body:{task:'command',project:'jihoceske',agent:'ceo',prompt:'test',provider:'openrouter',context:{safe:true}}},freeOpenRouter);
assert.equal(freeOpenRouter.statusCode,200,'OpenRouter :free models must remain usable with paid providers disabled');
assert.equal(freeOpenRouter.value.provider,'openrouter');

process.env.OPENROUTER_MODEL='openrouter/paid-model';
const paidOpenRouter=response();
await ai.default({method:'POST',headers:{authorization:'Bearer test-user-jwt'},body:{task:'command',project:'jihoceske',agent:'ceo',prompt:'test',provider:'openrouter',context:{safe:true}}},paidOpenRouter);
assert.equal(paidOpenRouter.statusCode,403,'paid OpenRouter models must remain blocked');

process.env.GEMINI_API_KEY='test-gemini-key';
process.env.AI_ALLOW_GEMINI_FREE_TIER='false';
const geminiBlocked=response();
await ai.default({method:'POST',headers:{authorization:'Bearer test-user-jwt'},body:{task:'command',project:'jihoceske',agent:'ceo',prompt:'test',provider:'gemini',context:{safe:true}}},geminiBlocked);
assert.equal(geminiBlocked.statusCode,403,'Gemini must not run without explicit free-tier opt-in or paid approval');
process.env.AI_ALLOW_GEMINI_FREE_TIER='true';
global.fetch=async(url,opt={})=>{
  const u=String(url);
  if(u.includes('generativelanguage.googleapis.com/v1beta/models/'))return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"ok":true,"source":"gemini-free-opt-in","intent":"test","project":"jihoceske","goal":"test","tasks":[],"notes":[]}'}]}}]}),{status:200,headers:{'content-type':'application/json'}});
  const authResponse=mockSupabaseAuth(u,opt);
  if(authResponse)return authResponse;
  return realFetch(url,opt);
};
const geminiFree=response();
await ai.default({method:'POST',headers:{authorization:'Bearer test-user-jwt'},body:{task:'command',project:'jihoceske',agent:'ceo',prompt:'test',provider:'gemini',context:{safe:true}}},geminiFree);
assert.equal(geminiFree.statusCode,200,'Gemini may run only after explicit free-tier opt-in');

console.log('AI AGENT RUNTIME OK — paid providers blocked, OpenRouter :free and explicitly opted-in Gemini free tier verified.');

global.fetch=realFetch;
