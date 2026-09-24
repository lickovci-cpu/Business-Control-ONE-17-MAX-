import {createHash} from 'node:crypto';
import {auth,noauth,body,projectKey,sendError,normalizeSecret} from './_lib.js';
import {createTask,getTask,blockTask,consumeApproval,startAttempt,completeTask,failAttempt} from './_control.js';

const SB_URL=process.env.SUPABASE_URL||'https://vjzzvopwecmwuccdidzq.supabase.co';
function validSupabaseKey(value){const s=normalizeSecret(value||'');return /^[\\x20-\\x7E]+$/.test(s)?s:'';}
const SB_KEY=validSupabaseKey(process.env.SUPABASE_SERVICE_ROLE_KEY)||validSupabaseKey(process.env.SUPABASE_SERVICE_KEY);
const ORGS={
  jihoceske:'09fb6fc9-7ea9-46ac-a84b-bd9952784c0c',
  fve:'09fb6fc9-7ea9-46ac-a84b-bd9952784c0c',
  mazliprint:'2d971414-9329-4d0b-94df-66cb8413f00c',
  merch:'d2751286-da99-42c0-b8ac-6a2da8ecdabf'
};
const STATUSES=new Set(['new','qualified','contacted','follow_up','offer','approved','job','delivered','invoiced','paid','closed']);
const TRANSITIONS={new:new Set(['contacted','qualified']),qualified:new Set(['contacted','follow_up','offer']),contacted:new Set(['qualified','follow_up','offer']),follow_up:new Set(['contacted','qualified','offer']),offer:new Set(['approved']),approved:new Set(['job']),job:new Set(['delivered']),delivered:new Set(['invoiced']),invoiced:new Set(['paid']),paid:new Set(['closed']),closed:new Set()};
const MUTATING=new Set(['create','update','status']);
function requireDb(){if(!SB_KEY){const e=new Error('CRM_DB_NOT_CONFIGURED');e.status=503;throw e;}}
function configuredProject(project){return Boolean(ORGS[project]);}
function headerValue(name,value){const s=String(value??'');for(let i=0;i<s.length;i++)if(s.charCodeAt(i)>255){const e=new Error(`${name}_INVALID_BYTE_STRING`);e.status=503;throw e;}return s;}
function org(project){const id=ORGS[project];if(!id){const e=new Error('CRM_PROJECT_ORG_NOT_CONFIGURED');e.status=503;throw e;}return id;}
async function sb(path,opt={}){requireDb();const key=headerValue('SUPABASE_KEY',SB_KEY);const r=await fetch(`${SB_URL}/rest/v1/${path}`,{...opt,headers:{apikey:key,Authorization:`Bearer ${key}`,'content-type':'application/json',...(opt.headers||{})},signal:AbortSignal.timeout(15000)});const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={raw:text}}if(!r.ok){const e=new Error(data.message||data.error||`SUPABASE_HTTP_${r.status}`);e.status=502;throw e;}return data;}
function taskAction(a){return `crm:lead-${a}`;}
function stable(v){if(Array.isArray(v))return '['+v.map(stable).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';return JSON.stringify(v);}
function fingerprint(v){return createHash('sha256').update(stable(v)).digest('hex');}
function approvedExecutionPayload(action,b,project,organization_id){return {project,organization_id,id:b.id||null,payload:b.payload||null,patch:b.patch||null,status:b.status||null,amount:b.amount??null};}
export function validateApprovedPayload(task,expectedTaskId,action,executionPayload,project){
  if(!task)throw new Error('TASK_NOT_FOUND');
  if(task.id!==String(expectedTaskId))throw new Error('TASK_ID_MISMATCH');
  if(task.project!==String(project))throw new Error('PROJECT_MISMATCH');
  if(task.action!==taskAction(action))throw new Error('APPROVAL_ACTION_MISMATCH');
  if(!task.payloadHash||fingerprint(executionPayload)!==task.payloadHash){const e=new Error('PAYLOAD_MISMATCH');e.status=409;throw e;}
  return true;
}
export function validateLeadTransition(from,to){
  const current=String(from||'new');const next=String(to||'');
  if(!STATUSES.has(next))throw new Error('INVALID_LEAD_STATUS');
  if(!STATUSES.has(current))throw new Error('INVALID_CURRENT_LEAD_STATUS');
  if(current===next)return true;
  if(!TRANSITIONS[current]?.has(next)){const e=new Error(`INVALID_LEAD_TRANSITION:${current}->${next}`);e.status=409;throw e;}
  return true;
}
async function assertApprovedPayload(task,expectedTaskId,action,executionPayload,project){try{return validateApprovedPayload(task,expectedTaskId,action,executionPayload,project);}catch(e){if(e.message==='PAYLOAD_MISMATCH')await blockTask(task?.id,'PAYLOAD_MISMATCH','Vytvořit novou approval žádost se stejným payloadem',null,project).catch(()=>{});throw e;}}
function cleanPatch(p){const out={};for(const k of ['estimated_value','source','note','next_action_at','last_contact_at','qualified_at','offered_at','approved_at','delivered_at','invoiced_at','paid_at','invoiced_amount','paid_amount'])if(Object.prototype.hasOwnProperty.call(p||{},k))out[k]=p[k]??null;return out;}
export default async function handler(req,res){
  if(!auth(req))return noauth(res);
  try{
    const project=projectKey(req.query?.project||'jihoceske');
    if(!ORGS[project]&&req.method==='GET')return res.json({ok:true,project,verified:false,configured:false,leads:[],error:'CRM_PROJECT_ORG_NOT_CONFIGURED'});
    const organization_id=org(project);
    if(req.method==='GET'){
      const rows=await sb(`leads?organization_id=eq.${organization_id}&select=*,contacts(id,name,phone,email)&order=created_at.desc&limit=500`);
      return res.json({ok:true,project,organization_id,verified:true,leads:Array.isArray(rows)?rows:[]});
    }
    if(req.method!=='POST')return res.status(405).json({error:'METHOD'});
    const b=await body(req,200000);const action=String(b.action||'');
    if(MUTATING.has(action)&&!b.approvalToken)return res.status(202).json(await queue(req,project,action,{project,organization_id,id:b.id||null,payload:b.payload||null,patch:b.patch||null,status:b.status||null,amount:b.amount??null}));
    if(!action.startsWith('execute-'))return res.status(400).json({error:'APPROVAL_REQUIRED'});
    const realAction=action.slice(8);if(!MUTATING.has(realAction))return res.status(400).json({error:'UNKNOWN_ACTION'});if(!b.taskId||!b.approvalToken)throw new Error('APPROVAL_REQUIRED');
    const executionPayload=approvedExecutionPayload(realAction,b,project,organization_id);
    const storedTask=await getTask(String(b.taskId));
    await assertApprovedPayload(storedTask,b.taskId,realAction,executionPayload,project);
    const task=await consumeApproval(b.taskId,b.approvalToken,req,project);await startAttempt(task.id,req,project);
    try{
      let result;
      if(realAction==='create'){
        const p=b.payload||{};if(!String(p.name||'').trim())throw new Error('LEAD_NAME_REQUIRED');
        const phone=String(p.phone||'').trim(),email=String(p.email||'').trim();
        let existing=[];
        if(phone)existing=await sb(`contacts?organization_id=eq.${organization_id}&phone=eq.${encodeURIComponent(phone)}&select=id,name,phone,email&limit=1`);
        if(!existing.length&&email)existing=await sb(`contacts?organization_id=eq.${organization_id}&email=eq.${encodeURIComponent(email)}&select=id,name,phone,email&limit=1`);
        let c=Array.isArray(existing)?existing[0]:null,newContact=false;
        if(!c){const contact=await sb('contacts',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({organization_id,name:String(p.contact||p.name).slice(0,200),phone:phone||null,email:email||null})});c=Array.isArray(contact)?contact[0]:contact;newContact=true;}
        const note=[p.note||'',p.web?`Web: ${p.web}`:'',p.region?`Region: ${p.region}`:'',p.leadType?`Typ: ${p.leadType}`:'',p.priority?`Priorita: ${p.priority}`:''].filter(Boolean).join(' · ');
        try{
          const lead=await sb('leads',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({organization_id,contact_id:c?.id||null,status:'new',estimated_value:p.estimated_value??null,note:note||null,source:p.source||null})});result=Array.isArray(lead)?lead[0]:lead;
        }catch(e){if(newContact&&c?.id)await sb(`contacts?id=eq.${encodeURIComponent(c.id)}&organization_id=eq.${organization_id}`,{method:'DELETE'}).catch(()=>{});throw e;}
      } else if(realAction==='status'){
        const rows=await sb(`leads?id=eq.${encodeURIComponent(b.id)}&organization_id=eq.${organization_id}&select=id,status,invoiced_amount,paid_amount`);if(!Array.isArray(rows)||!rows[0])throw new Error('LEAD_NOT_FOUND');
        validateLeadTransition(rows[0].status,b.status);
        const now=new Date().toISOString(),patch={status:b.status,updated_at:now};if(b.status==='qualified')patch.qualified_at=now;if(b.status==='contacted')patch.last_contact_at=now;if(b.status==='offer')patch.offered_at=now;if(b.status==='approved')patch.approved_at=now;if(b.status==='delivered')patch.delivered_at=now;if(b.status==='invoiced')patch.invoiced_at=now;if(b.status==='paid')patch.paid_at=now;
        if(b.status==='invoiced'&&b.amount!=null)patch.invoiced_amount=Number(b.amount);if(b.status==='paid'&&b.amount!=null)patch.paid_amount=Number(b.amount);
        const updated=await sb(`leads?id=eq.${encodeURIComponent(b.id)}&organization_id=eq.${organization_id}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});result=Array.isArray(updated)?updated[0]:updated;
      } else {
        const patch=cleanPatch(b.patch||{});const current=await sb(`leads?id=eq.${encodeURIComponent(b.id)}&organization_id=eq.${organization_id}&select=contact_id`);const cid=current?.[0]?.contact_id;if(cid&&(b.patch?.name||b.patch?.phone||b.patch?.email))await sb(`contacts?id=eq.${encodeURIComponent(cid)}&organization_id=eq.${organization_id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({...(b.patch?.name?{name:b.patch.name}:{}),...(b.patch?.phone?{phone:b.patch.phone}:{}),...(b.patch?.email?{email:b.patch.email}:{})})});
        const updated=await sb(`leads?id=eq.${encodeURIComponent(b.id)}&organization_id=eq.${organization_id}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...patch,updated_at:new Date().toISOString()})});result=Array.isArray(updated)?updated[0]:updated;
      }
      const referenceId=result?.id||b.id||null;
      if(!referenceId)throw new Error('RESULT_REFERENCE_REQUIRED');
      const resultHash=fingerprint(result);
      const evidence=[{type:'crm_db_mutation',action:task.action,entityType:'lead',entityId:String(referenceId),taskId:task.id,payloadHash:task.payloadHash,attemptId:task.attemptId,resultHash,referenceId:String(referenceId)}];
      const done=await completeTask(task.id,evidence,req,project,result);return res.json({ok:true,verified:true,result,task:done});
    }catch(e){await failAttempt(task.id,e.message,req,project).catch(()=>{});throw e;}
  }catch(e){
    console.error('CRM_LEADS_ERROR',JSON.stringify({project:req.query?.project||'jihoceske',action:req.body?.action||null,status:e?.status||500,name:e?.name||'Error',message:String(e?.message||'UNKNOWN_ERROR').slice(0,300)}));
    return sendError(res,e);
  }
}
function queue(req,project,action,payload){return createTask({project,agent:'crm',action:taskAction(action),payload,actor:req.headers?.['x-bco-actor']||'user',evidenceRequired:true}).then(task=>({approvalRequired:true,task}));}
