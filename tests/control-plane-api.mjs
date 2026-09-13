import assert from 'node:assert/strict';

process.env.APP_PASSWORD='test-password';
process.env.APP_CONFIRM_SECRET='confirm-test';
process.env.APP_SESSION_SECRET='session-test';
process.env.NODE_ENV='test';
process.env.KV_REST_API_URL='https://fake-kv';
process.env.KV_REST_API_TOKEN='test';
process.env.META_PAGE_TOKEN='test-meta-token';
process.env.META_PAGE_ID='117';

const db=new Map();
const lists=new Map();
const realFetch=global.fetch;
global.fetch=async(url,opt={})=>{
  const u=String(url);
  if(u==='https://fake-kv'){
    const cmd=JSON.parse(opt.body),op=cmd[0],key=String(cmd[1]??'');let result=null;
    if(op==='GET')result=db.get(key)??null;
    else if(op==='MGET')result=cmd.slice(1).map(k=>db.get(String(k))??null);
    else if(op==='SET'){const nx=cmd.includes('NX');if(nx&&db.has(key))result=null;else{db.set(key,String(cmd[2]));result='OK';}}
    else if(op==='DEL')result=db.delete(key)?1:0;
    else if(op==='LPUSH'){const a=lists.get(key)||[];a.unshift(String(cmd[2]));lists.set(key,a);result=a.length;}
    else if(op==='LTRIM'){const a=lists.get(key)||[];lists.set(key,a.slice(Number(cmd[2]),Number(cmd[3])+1));result='OK';}
    else if(op==='LRANGE'){const a=lists.get(key)||[];result=a.slice(Number(cmd[2]),Number(cmd[3])+1);}
    else throw new Error(`Unsupported KV op ${op}`);
    return new Response(JSON.stringify({result}),{status:200,headers:{'content-type':'application/json'}});
  }
  if(u.startsWith('https://graph.facebook.com/'))return new Response(JSON.stringify({id:'117',name:'Test Page',data:[],access_token:'test-meta-token'}),{status:200,headers:{'content-type':'application/json'}});
  return realFetch(url,opt);
};

function response(){let statusCode=200,value;return{status(n){statusCode=n;return this;},json(v){value=v;return v;},get statusCode(){return statusCode;},get value(){return value;}};}
const reqBase={method:'POST',headers:{'x-app-key':'test-password'},query:{}};
const control=await import('../api/control.js');
const comms=await import('../api/comms.js');
const meta=await import('../api/meta.js');
const metaPhoto=await import('../api/meta-photo.js');

const createdRes=response();
await control.default({...reqBase,query:{action:'create'},body:{project:'jihoceske',agent:'test',action:'comms:send',payload:{project:'jihoceske',channel:'email',to:'x@example.com',text:'x'}}},createdRes);
assert.equal(createdRes.statusCode,201);
const taskId=createdRes.value.task.id;

const mismatchRes=response();
await control.default({...reqBase,query:{action:'task',id:taskId,project:'mazliprint'},method:'GET'},mismatchRes);
assert.equal(mismatchRes.statusCode,409);
assert.equal(mismatchRes.value.error,'PROJECT_MISMATCH');

const directComms=response();
await comms.default({...reqBase,query:{action:'send',project:'jihoceske'},body:{project:'jihoceske',channel:'email',to:'x@example.com',text:'x'}},directComms);
assert.equal(directComms.statusCode,400);
assert.equal(directComms.value.error,'CONFIRMATION_REQUIRED');

const directMeta=response();
await meta.default({...reqBase,query:{action:'publish',project:'jihoceske'},body:{project:'jihoceske',message:'x'}},directMeta);
assert.equal(directMeta.statusCode,400);
assert.equal(directMeta.value.error,'CONFIRMATION_REQUIRED');

const directSchedule=response();
await meta.default({...reqBase,query:{action:'schedule',project:'jihoceske'},body:{project:'jihoceske',message:'x',when:new Date(Date.now()+3600000).toISOString()}},directSchedule);
assert.equal(directSchedule.statusCode,400);
assert.equal(directSchedule.value.error,'CONFIRMATION_REQUIRED');

const directPhoto=response();
const photoManifest=Buffer.from(JSON.stringify([{mime:'image/jpeg',size:1,sha256:'00'}])).toString('base64url');
await metaPhoto.default({method:'POST',headers:{'x-app-key':'test-password','x-project':'jihoceske','x-photo-manifest':photoManifest,'x-photo-index':'0','content-type':'image/jpeg','x-confirm-token':''},async*(){yield Buffer.from([0])}},directPhoto);
assert.equal(directPhoto.statusCode,400);
assert.equal(directPhoto.value.error,'CONTROL_APPROVAL_REQUIRED');

console.log('CONTROL PLANE API OK — direct control/comms/Meta/photo mutations require auth and approval; project isolation enforced.');
