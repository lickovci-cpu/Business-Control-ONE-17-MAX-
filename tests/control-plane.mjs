import assert from 'node:assert/strict';

process.env.APP_PASSWORD='test-password';
process.env.APP_CONFIRM_SECRET='confirm-test';
process.env.APP_SESSION_SECRET='session-test';
process.env.NODE_ENV='test';

const db=new Map();
const lists=new Map();
const realFetch=global.fetch;
global.fetch=async(url,opt={})=>{
  if(String(url)==='https://fake-kv'){
    const cmd=JSON.parse(opt.body),op=cmd[0],key=String(cmd[1]??'');let result=null;
    if(op==='GET')result=db.get(key)??null;
    else if(op==='MGET')result=cmd.slice(1).map(k=>db.get(String(k))??null);
    else if(op==='SET'){
      const nx=cmd.includes('NX');
      if(nx&&db.has(key))result=null;else{db.set(key,String(cmd[2]));result='OK';}
    }else if(op==='DEL')result=db.delete(key)?1:0;
    else if(op==='LPUSH'){const a=lists.get(key)||[];a.unshift(String(cmd[2]));lists.set(key,a);result=a.length;}
    else if(op==='LTRIM'){const a=lists.get(key)||[];lists.set(key,a.slice(Number(cmd[2]),Number(cmd[3])+1));result='OK';}
    else if(op==='LRANGE'){const a=lists.get(key)||[];result=a.slice(Number(cmd[2]),Number(cmd[3])+1);}
    else throw new Error(`Unsupported KV op ${op}`);
    return new Response(JSON.stringify({result}),{status:200,headers:{'content-type':'application/json'}});
  }
  return realFetch(url,opt);
};
process.env.KV_REST_API_URL='https://fake-kv';
process.env.KV_REST_API_TOKEN='test';

const control=await import('../api/_control.js');
const confirm=await import('../api/_confirm.js');
const req={headers:{'x-bco-actor':'test'}};
const payload={project:'jihoceske',channel:'email',to:'test@example.com',text:'hello'};

const task=await control.createTask({project:'jihoceske',agent:'sales',action:'comms:send',payload,actor:'test'});
assert.equal(task.status,'WAITING_APPROVAL');
await assert.rejects(()=>control.requestApproval(task.id,req,'mazliprint'),/PROJECT_MISMATCH/);
const approval=await control.requestApproval(task.id,req,'jihoceske');
assert.equal(approval.task.id,task.id);
assert.equal(confirm.verifyConfirmation(approval.approvalToken,'control:comms:send',{taskId:task.id,project:'jihoceske',action:'comms:send',payloadHash:task.payloadHash}),true);
await assert.rejects(()=>control.consumeApproval(task.id,approval.approvalToken,req,'mazliprint'),/PROJECT_MISMATCH/);
const approved=await control.consumeApproval(task.id,approval.approvalToken,req,'jihoceske');
assert.equal(approved.status,'APPROVED');
await assert.rejects(()=>control.consumeApproval(task.id,approval.approvalToken,req,'jihoceske'),/(APPROVAL_ALREADY_USED|TASK_NOT_APPROVABLE)/);

const attempt=await control.startAttempt(task.id,req,'jihoceske');
assert.equal(attempt.status,'EXECUTING');
assert.ok(attempt.attemptId);
await assert.rejects(()=>control.startAttempt(task.id,req,'jihoceske'),/ATTEMPT_ALREADY_RUNNING|TASK_NOT_APPROVED/);
await assert.rejects(()=>control.completeTask(task.id,[],req,'jihoceske'),/EVIDENCE_REQUIRED/);
const done=await control.completeTask(task.id,[{type:'message_sent',referenceId:'msg-1'}],req,'jihoceske');
assert.equal(done.status,'DONE');

const legacy=confirm.createConfirmation('comms:send',payload,900);
const ran=await control.runControlledMutation({action:'comms:send',project:'jihoceske',payload,confirmationToken:legacy,agent:'sales',req,execute:async()=>({id:'x'})});
assert.equal(ran.task.status,'DONE');
assert.ok(ran.task.attemptId);
await assert.rejects(()=>control.runControlledMutation({action:'comms:send',project:'jihoceske',payload,confirmationToken:legacy,agent:'sales',req,execute:async()=>({id:'x'})}),/APPROVAL_ALREADY_USED/);

const mismatch=confirm.createConfirmation('comms:send',{...payload,text:'different'},900);
await assert.rejects(()=>control.runControlledMutation({action:'comms:send',project:'jihoceske',payload,confirmationToken:mismatch,agent:'sales',req,execute:async()=>({id:'x'})}),/CONFIRMATION_PAYLOAD_CHANGED/);

const blocked=await control.createTask({project:'jihoceske',agent:'sales',action:'comms:send',payload,actor:'test'});
const blockedTask=await control.blockTask(blocked.id,'Meta není dostupná','Obnovit token',req,'jihoceske');
assert.equal(blockedTask.status,'BLOCKED');
assert.equal(blockedTask.blockReason,'Meta není dostupná');
assert.equal(blockedTask.nextStep,'Obnovit token');

console.log('CONTROL PLANE OK — lifecycle, evidence, approval binding, one-time consumption, replay protection, project isolation, attempt lineage and BLOCKED state.');
