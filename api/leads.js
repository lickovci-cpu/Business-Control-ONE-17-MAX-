import {auth,noauth,body,projectKey,sendError} from './_lib.js';
import {createTask,consumeApproval,startAttempt,completeTask,failAttempt} from './_control.js';

const SB_URL=process.env.SUPABASE_URL||'https://vjzzvopwecmwuccdidzq.supabase.co';
const SB_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||'';
const ORGS={jihoceske:'09fb6fc9-7ea9-46ac-a84b-bd9952784c0c',merch:'d2751286-da99-42c0-b8ac-6a2da8ecdabf'};
const STATUSES=new Set(['new','qualified','contacted','follow_up','offer','approved','job','delivered','invoiced','paid','closed']);
const MUTATING=new Set(['create','update','status']);
function requireDb(){if(!SB_KEY){const e=new Error('CRM_DB_NOT_CONFIGURED');e.status=503;throw e;}}
function org(project){const id=ORGS[project];if(!id)throw new Error('CRM_PROJECT_ORG_NOT_CONFIGURED');return id;}
async function sb(path,opt={}){requireDb();const r=await fetch(`${SB_URL}/rest/v1/${path}`,{...opt,headers:{apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`,'content-type':'application/json',...(opt.headers||{})},signal:AbortSignal.timeout(15000)});const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={raw:text}}if(!r.ok){const e=new Error(data.message||data.error||`SUPABASE_HTTP_${r.status}`);e.status=502;throw e;}return data;}
function taskAction(a){return `crm:lead-${a}`;}
async function queue(req,project,action,payload){const task=await createTask({project,agent:'crm',action:taskAction(action),payload,actor:req.headers?.['x-bco-actor']||'user',evidenceRequired:true});return {approvalRequired:true,task};}
function cleanPatch(p){const out={};for(const k of ['estimated_value','source','note','next_action_at','last_contact_at','qualified_at','offered_at','approved_at','delivered_at','invoiced_at','paid_at','invoiced_amount','paid_amount'])if(Object.prototype.hasOwnProperty.call(p||{},k))out[k]=p[k]??null;return out;}
export default async function handler(req,res){
  if(!auth(req))return noauth(res);
  try{
    const project=projectKey(req.query?.project||'jihoceske');
    const organization_id=org(project);
    if(req.method==='GET'){
      const rows=await sb(`leads?organization_id=eq.${organization_id}&select=*,contacts(id,name,phone,email)&order=created_at.desc&limit=500`);
      return res.json({ok:true,project,organization_id,verified:true,leads:Array.isArray(rows)?rows:[]});
    }
    if(req.method!=='POST')return res.status(405).json({error:'METHOD'});
    const b=await body(req,200000);const action=String(b.action||'');
    if(MUTATING.has(action)&&!b.approvalToken)return res.status(202).json(await queue(req,project,action,{project,organization_id,id:b.id||null,payload:b.payload||null,patch:b.patch||null,status:b.status||null}));
    if(!action.startsWith('execute-'))return res.status(400).json({error:'APPROVAL_REQUIRED'});
    const realAction=action.slice(8);if(!MUTATING.has(realAction))return res.status(400).json({error:'UNKNOWN_ACTION'});if(!b.taskId||!b.approvalToken)throw new Error('APPROVAL_REQUIRED');
    const task=await consumeApproval(b.taskId,b.approvalToken,req,project);if(task.action!==taskAction(realAction))throw new Error('APPROVAL_ACTION_MISMATCH');await startAttempt(task.id,req,project);
    try{
      let result;
      if(realAction==='create'){
        const p=b.payload||{};if(!String(p.name||'').trim())throw new Error('LEAD_NAME_REQUIRED');
        const contact=await sb('contacts',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({organization_id,name:String(p.contact||p.name).slice(0,200),phone:p.phone||null,email:p.email||null})});
        const c=Array.isArray(contact)?contact[0]:contact;const note=[p.note||'',p.web?`Web: ${p.web}`:'',p.region?`Region: ${p.region}`:'',p.leadType?`Typ: ${p.leadType}`:'',p.priority?`Priorita: ${p.priority}`:''].filter(Boolean).join(' · ');
        const lead=await sb('leads',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({organization_id,contact_id:c?.id||null,status:'new',estimated_value:p.estimated_value??null,note:note||null,source:p.source||null})});result=Array.isArray(lead)?lead[0]:lead;
      } else if(realAction==='status'){
        if(!STATUSES.has(String(b.status)))throw new Error('INVALID_LEAD_STATUS');
        const rows=await sb(`leads?id=eq.${encodeURIComponent(b.id)}&organization_id=eq.${organization_id}&select=id`);if(!Array.isArray(rows)||!rows[0])throw new Error('LEAD_NOT_FOUND');
        const now=new Date().toISOString(),patch={status:b.status,updated_at:now};if(b.status==='qualified')patch.qualified_at=now;if(b.status==='contacted')patch.last_contact_at=now;if(b.status==='offer')patch.offered_at=now;if(b.status==='approved')patch.approved_at=now;if(b.status==='delivered')patch.delivered_at=now;if(b.status==='invoiced')patch.invoiced_at=now;if(b.status==='paid')patch.paid_at=now;
        const updated=await sb(`leads?id=eq.${encodeURIComponent(b.id)}&organization_id=eq.${organization_id}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});result=Array.isArray(updated)?updated[0]:updated;
      } else {
        const patch=cleanPatch(b.patch||{});const current=await sb(`leads?id=eq.${encodeURIComponent(b.id)}&organization_id=eq.${organization_id}&select=contact_id`);const cid=current?.[0]?.contact_id;if(cid&&(b.patch?.name||b.patch?.phone||b.patch?.email))await sb(`contacts?id=eq.${encodeURIComponent(cid)}&organization_id=eq.${organization_id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({...(b.patch?.name?{name:b.patch.name}:{}),...(b.patch?.phone?{phone:b.patch.phone}:{}),...(b.patch?.email?{email:b.patch.email}:{})})});
        const updated=await sb(`leads?id=eq.${encodeURIComponent(b.id)}&organization_id=eq.${organization_id}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({...patch,updated_at:new Date().toISOString()})});result=Array.isArray(updated)?updated[0]:updated;
      }
      const done=await completeTask(task.id,[{type:'crm_db_mutation',action:realAction,entityType:'lead',entityId:result?.id||b.id||null,verifiedAt:new Date().toISOString()}],req,project);return res.json({ok:true,verified:true,result,task:done});
    }catch(e){await failAttempt(task.id,e.message,req,project).catch(()=>{});throw e;}
  }catch(e){return sendError(res,e);}
}
