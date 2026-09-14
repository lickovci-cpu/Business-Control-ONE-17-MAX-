import {randomUUID} from 'node:crypto';
import {auth,noauth,body,projectKey,sendError,kvGet,kvSet,kvLpush,kvLtrim,kvLrange,kvMget,kvZadd,kvZrem} from './_lib.js';
import {sendCommunication,commsStatus} from './_comms.js';
import {runControlledMutation,createTask,requestApproval} from './_control.js';
const INDEX='business-control:outbox:index',DUE='business-control:outbox:due',ITEM=id=>`business-control:outbox:item:${id}`;
function normalize(b,{withWhen=false}={}){const out={project:projectKey(b.project),channel:String(b.channel||'email').toLowerCase(),to:String(b.to||'').trim().slice(0,320),subject:String(b.subject||'').slice(0,998),text:String(b.text||'').slice(0,12000),templateName:String(b.templateName||''),templateLanguage:String(b.templateLanguage||'cs'),trafficType:String(b.trafficType||'SERVICEREQUEST')};if(withWhen)out.when=new Date(b.when).toISOString();return out;}
function validate(p,{withWhen=false}={}){if(!['email','whatsapp','rcs'].includes(p.channel))throw new Error('INVALID_CHANNEL');if(!p.to||!p.text)throw new Error('MISSING_RECIPIENT_OR_TEXT');if(withWhen&&!p.when)throw new Error('INVALID_TIME');}
async function getItem(id){return await kvGet(ITEM(id));}
async function saveItem(item){const ok=await kvSet(ITEM(item.id),item);if(!ok){const e=new Error('QUEUE_STORAGE_NOT_CONFIGURED');e.status=503;throw e;}return item;}
async function listItems(project,limit=100){const ids=await kvLrange(INDEX,0,499);if(!ids.length)return[];const rows=await kvMget(ids.map(ITEM));return rows.map(x=>{if(!x)return null;try{return typeof x==='string'?JSON.parse(x):x}catch{return null}}).filter(x=>x&&x.project===project).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,limit);}
function sameProject(x,p){if(!x)return false;if(x.project!==p){const e=new Error('PROJECT_MISMATCH');e.status=409;throw e;}return true;}
async function approvalPreview(action,project,payload,req,agent='user'){const task=await createTask({project,agent,action,payload,actor:agent,evidenceRequired:true});const approval=await requestApproval(task.id,req);return {preview:payload,confirmationToken:approval.approvalToken,controlTaskId:task.id,approvalId:approval.approvalId};}
export default async function handler(req,res){
  if(!auth(req))return noauth(res);
  try{
    const action=String(req.query.action||'status'),project=projectKey(req.query.project||'jihoceske');
    if(action==='status')return res.json({...commsStatus(),project});
    if(action==='list')return res.json({items:await listItems(project,100)});
    if(req.method!=='POST')return res.status(405).json({error:'METHOD'});
    const b=await body(req);b.project=projectKey(b.project||project);
    if(action==='preview-send'){const payload=normalize(b);validate(payload);return res.json(await approvalPreview('comms:send',payload.project,payload,req,String(b.agent||'user')));}
    if(action==='send'){const payload=normalize(b);validate(payload);const out=await runControlledMutation({action:'comms:send',project:payload.project,payload,confirmationToken:b.confirmationToken,agent:String(b.agent||'user'),req,execute:async()=>await sendCommunication(payload)});return res.json({ok:true,result:out.result,controlTask:out.task});}
    if(action==='preview-queue'){const when=new Date(b.when);if(!b.when||Number.isNaN(when.getTime()))return res.status(400).json({error:'INVALID_TIME'});const payload=normalize({...b,when:when.toISOString()},{withWhen:true});validate(payload,{withWhen:true});return res.json(await approvalPreview('comms:queue',payload.project,payload,req,String(b.agent||'user')));}
    if(action==='queue'){
      const when=new Date(b.when);if(!b.when||Number.isNaN(when.getTime()))return res.status(400).json({error:'INVALID_TIME'});const payload=normalize({...b,when:when.toISOString()},{withWhen:true});validate(payload,{withWhen:true});const out=await runControlledMutation({action:'comms:queue',project:payload.project,payload,confirmationToken:b.confirmationToken,agent:String(b.agent||'user'),req,execute:async()=>{const item={id:randomUUID(),...payload,status:'queued',attempts:0,nextAttemptAt:payload.when,approvedAt:new Date().toISOString(),createdAt:new Date().toISOString()};await saveItem(item);await kvLpush(INDEX,item.id);await kvLtrim(INDEX,0,499);await kvZadd(DUE,new Date(item.when).getTime(),item.id);return item;}});return res.json({ok:true,item:out.result,controlTask:out.task});
    }
    if(action==='cancel'){const x=await getItem(String(b.id||''));if(!x)return res.status(404).json({error:'NOT_FOUND'});sameProject(x,b.project);if(!['queued','retry_wait'].includes(x.status))return res.status(409).json({error:'NOT_QUEUED'});const payload={project:x.project,id:x.id,status:x.status};const out=await runControlledMutation({action:'comms:cancel',project:x.project,payload,confirmationToken:b.confirmationToken,agent:String(b.agent||'user'),req,execute:async()=>{x.status='cancelled';x.cancelledAt=new Date().toISOString();await saveItem(x);await kvZrem(DUE,x.id);return x;}});return res.json({ok:true,item:out.result,controlTask:out.task});}
    if(action==='preview-retry'){const x=await getItem(String(b.id||''));if(!x)return res.status(404).json({error:'NOT_FOUND'});sameProject(x,b.project);if(!['failed','needs_review'].includes(x.status))return res.status(409).json({error:'NOT_RETRYABLE'});const payload={project:x.project,id:x.id,status:x.status,to:x.to,channel:x.channel,text:x.text,subject:x.subject||''};return res.json(await approvalPreview('comms:retry',payload.project,payload,req,String(b.agent||'user')));}
    if(action==='retry'){const x=await getItem(String(b.id||''));if(!x)return res.status(404).json({error:'NOT_FOUND'});sameProject(x,b.project);const payload={project:x.project,id:x.id,status:x.status,to:x.to,channel:x.channel,text:x.text,subject:x.subject||''};const out=await runControlledMutation({action:'comms:retry',project:x.project,payload,confirmationToken:b.confirmationToken,agent:String(b.agent||'user'),req,execute:async()=>{x.status='queued';x.nextAttemptAt=new Date().toISOString();x.lastError='';x.deliveryUncertain=false;await saveItem(x);await kvZadd(DUE,Date.now(),x.id);return x;}});return res.json({ok:true,item:out.result,controlTask:out.task});}
    return res.status(400).json({error:'UNKNOWN_ACTION'});
  }catch(e){return sendError(res,e);}
}
