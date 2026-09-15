import {createHash} from 'node:crypto';
import {auth,noauth,projectKey,sendError,body} from './_lib.js';
import {createTask,getTask,blockTask,consumeApproval,startAttempt,completeTask,failAttempt} from './_control.js';

const SB_URL=process.env.SUPABASE_URL||'https://vjzzvopwecmwuccdidzq.supabase.co';
const SB_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||'';
const ORGS={jihoceske:'09fb6fc9-7ea9-46ac-a84b-bd9952784c0c',merch:'d2751286-da99-42c0-b8ac-6a2da8ecdabf'};
const ACTIONS=new Set(['create-quote','create-job','create-financial']);
function requireDb(){if(!SB_KEY){const e=new Error('COMMERCIAL_DB_NOT_CONFIGURED');e.status=503;throw e;}}
function org(project){const id=ORGS[project];if(!id)throw new Error('COMMERCIAL_PROJECT_ORG_NOT_CONFIGURED');return id;}
async function sb(path,opt={}){requireDb();const r=await fetch(`${SB_URL}/rest/v1/${path}`,{...opt,headers:{apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`,'content-type':'application/json',...(opt.headers||{})},signal:AbortSignal.timeout(15000)});const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={raw:text}}if(!r.ok){const e=new Error(data.message||data.error||`SUPABASE_HTTP_${r.status}`);e.status=502;throw e;}return data;}
function stable(v){if(Array.isArray(v))return '['+v.map(stable).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';return JSON.stringify(v);}
function fingerprint(v){return createHash('sha256').update(stable(v)).digest('hex');}
function actionName(a){return `commercial:${a}`;}
function payloadFor(action,b,project,organization_id){return {project,organization_id,action,payload:b.payload||null};}
function evidence(task,result){const reference=String(result?.id||'');if(!reference)throw new Error('RESULT_REFERENCE_REQUIRED');const resultHash=fingerprint(result);return [{type:'commercial_db_mutation',action:task.action,entityType:String(task.action).replace('commercial:',''),entityId:reference,taskId:task.id,payloadHash:task.payloadHash,attemptId:task.attemptId,resultHash,referenceId:reference}];}
async function execute(action,payload,organization_id){
  if(action==='create-quote'){
    const p=payload||{},total=Number(p.total||0);if(!String(p.quote_number||'').trim())throw new Error('QUOTE_NUMBER_REQUIRED');if(!Number.isFinite(total)||total<0)throw new Error('QUOTE_TOTAL_INVALID');
    const rows=await sb('quotes',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({organization_id,quote_number:String(p.quote_number).slice(0,80),contact_id:p.contact_id||null,opportunity_id:p.opportunity_id||null,status:'draft',subtotal:Number(p.subtotal||0),tax:Number(p.tax||0),total,currency:String(p.currency||'CZK').slice(0,8),valid_until:p.valid_until||null,notes:p.notes||null})});return Array.isArray(rows)?rows[0]:rows;
  }
  if(action==='create-job'){
    const p=payload||{},title=String(p.title||'').trim();if(!title)throw new Error('JOB_TITLE_REQUIRED');const price=Number(p.price||0),cost=Number(p.direct_cost||0);if(!Number.isFinite(price)||price<0||!Number.isFinite(cost)||cost<0)throw new Error('JOB_AMOUNT_INVALID');
    const rows=await sb('jobs',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({organization_id,contact_id:p.contact_id||null,title:title.slice(0,200),address:p.address||null,status:String(p.status||'planned').slice(0,40),scheduled_at:p.scheduled_at||null,note:p.note||null,price,direct_cost:cost})});return Array.isArray(rows)?rows[0]:rows;
  }
  if(action==='create-financial'){
    const p=payload||{},entryType=String(p.entry_type||'income').toLowerCase(),amount=Number(p.amount);if(!['income','expense'].includes(entryType))throw new Error('FINANCIAL_ENTRY_TYPE_INVALID');if(!Number.isFinite(amount)||amount<0)throw new Error('FINANCIAL_AMOUNT_INVALID');if(!p.occurred_on)throw new Error('FINANCIAL_DATE_REQUIRED');
    const rows=await sb('financial_entries',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({organization_id,entry_type:entryType,category:p.category||null,amount,currency:String(p.currency||'CZK').slice(0,8),occurred_on:p.occurred_on,status:String(p.status||'confirmed').slice(0,40),counterparty:p.counterparty||null,reference:p.reference||null,note:p.note||null,job_id:p.job_id||null,opportunity_id:p.opportunity_id||null})});return Array.isArray(rows)?rows[0]:rows;
  }
  throw new Error('UNKNOWN_ACTION');
}
export default async function handler(req,res){
  if(!auth(req))return noauth(res);
  try{
    const project=projectKey(req.query?.project||'jihoceske'),organization_id=org(project);
    if(req.method==='GET'){
      const [quotes,jobs,financial,opportunities]=await Promise.all([
        sb(`quotes?organization_id=eq.${organization_id}&select=id,quote_number,contact_id,opportunity_id,status,subtotal,tax,total,currency,valid_until,issued_at,accepted_at,notes,created_at,updated_at&order=created_at.desc&limit=200`),
        sb(`jobs?organization_id=eq.${organization_id}&select=id,contact_id,title,address,status,scheduled_at,note,price,direct_cost,created_at,updated_at&order=created_at.desc&limit=200`),
        sb(`financial_entries?organization_id=eq.${organization_id}&select=id,entry_type,category,amount,currency,occurred_on,status,counterparty,reference,note,job_id,opportunity_id,created_at&order=occurred_on.desc&limit=300`),
        sb(`opportunities?organization_id=eq.${organization_id}&select=id,contact_id,title,stage,priority,value,probability,source,next_action,next_action_at,notes,owner_user_id,created_at,updated_at&order=created_at.desc&limit=200`)
      ]);
      const rows=a=>Array.isArray(a)?a:[],q=rows(quotes),j=rows(jobs),f=rows(financial),o=rows(opportunities),income=f.filter(x=>String(x.entry_type).toLowerCase()==='income').reduce((s,x)=>s+Number(x.amount||0),0),expense=f.filter(x=>String(x.entry_type).toLowerCase()==='expense').reduce((s,x)=>s+Number(x.amount||0),0),openQuotes=q.filter(x=>!['accepted','rejected','expired','cancelled'].includes(String(x.status||'').toLowerCase())),activeJobs=j.filter(x=>!['done','completed','cancelled','closed'].includes(String(x.status||'').toLowerCase()));
      return res.json({ok:true,verified:true,project,organization_id,source:'supabase',commercial:{quotes:q,jobs:j,financial_entries:f,opportunities:o,summary:{quoteCount:q.length,openQuoteCount:openQuotes.length,jobCount:j.length,activeJobCount:activeJobs.length,opportunityCount:o.length,income,expense,netCash:income-expense}}});
    }
    if(req.method!=='POST')return res.status(405).json({error:'METHOD'});
    const b=await body(req,200000),action=String(b.action||'');
    if(!ACTIONS.has(action))return res.status(400).json({error:'UNKNOWN_ACTION'});
    const payload=payloadFor(action,b,project,organization_id);
    if(!b.approvalToken)return res.status(202).json({approvalRequired:true,task:await createTask({project,agent:'commercial',action:actionName(action),payload,actor:req.headers?.['x-bco-actor']||'user',evidenceRequired:true})});
    if(!b.taskId)throw new Error('APPROVAL_REQUIRED');
    const task=await getTask(String(b.taskId));if(!task)throw new Error('TASK_NOT_FOUND');if(task.action!==actionName(action))throw new Error('APPROVAL_ACTION_MISMATCH');if(task.payloadHash!==fingerprint(payload)){await blockTask(task.id,'PAYLOAD_MISMATCH','Vytvořit novou approval žádost se stejným payloadem',null,project).catch(()=>{});throw new Error('PAYLOAD_MISMATCH');}
    const approved=await consumeApproval(task.id,b.approvalToken,req,project);await startAttempt(approved.id,req,project);
    try{const result=await execute(action,b.payload||{},organization_id);const done=await completeTask(approved.id,evidence(approved,result),req,project,result);return res.json({ok:true,verified:true,result,task:done});}catch(e){await failAttempt(approved.id,e.message,req,project).catch(()=>{});throw e;}
  }catch(e){return sendError(res,e);}
}
