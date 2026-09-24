import assert from 'node:assert/strict';

process.env.APP_PASSWORD='test-password';
process.env.NODE_ENV='production';
process.env.OPENAI_API_KEY='test-openai-key';
process.env.GEMINI_API_KEY='';
process.env.ANTHROPIC_API_KEY='';
process.env.OPENROUTER_API_KEY='';
process.env.CUSTOM_AI_URL='';

const realFetch=global.fetch;
global.fetch=async(url,opt={})=>{
  const u=String(url);
  if(u==='https://api.openai.com/v1/responses'){
    const body=JSON.parse(opt.body);
    assert.equal(body.model,'gpt-5.6-luna');
    assert.equal(body.input?.[0]?.role,'user');
    assert.ok(Array.isArray(body.input?.[0]?.content));
    return new Response(JSON.stringify({output_text:'{"ok":true,"source":"openai"}'}),{status:200,headers:{'content-type':'application/json'}});
  }
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
  headers:{'x-app-key':'test-password'},
  body:{task:'command',project:'jihoceske',agent:'ceo',prompt:'test',provider:'openai',context:{safe:true}}
},res);

assert.equal(res.statusCode,200);
assert.equal(res.value.provider,'openai');
assert.equal(res.value.model,'gpt-5.6-luna');
assert.equal(res.value.structuredExpected,true);
assert.equal(res.value.structuredValid,true);
assert.deepEqual(res.value.parsed,{ok:true,source:'openai'});
assert.deepEqual(res.value.attemptedProviders,['openai']);

process.env.OPENAI_API_KEY='';
process.env.AI_COST_MODE='free-first';
process.env.AI_ALLOW_PAID_FALLBACKS='false';

const auto=response();
await ai.default({
  method:'POST',
  headers:{'x-app-key':'test-password'},
  body:{task:'command',project:'jihoceske',agent:'ceo',prompt:'test',provider:'auto',context:{safe:true}}
},auto);

assert.notEqual(auto.statusCode,200);
assert.equal(auto.statusCode,500);

console.log('AI AGENT RUNTIME OK — explicit OpenAI routing works, structured JSON is parsed, and disabled paid fallbacks remain blocked.');

global.fetch=realFetch;
