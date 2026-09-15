import {auth,noauth,projectKey,sendError} from './_lib.js';

const SB_URL=process.env.SUPABASE_URL||'https://vjzzvopwecmwuccdidzq.supabase.co';
const SB_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||'';
const ORGS={jihoceske:'09fb6fc9-7ea9-46ac-a84b-bd9952784c0c',merch:'d2751286-da99-42c0-b8ac-6a2da8ecdabf'};
function requireDb(){if(!SB_KEY){const e=new Error('COMMERCIAL_DB_NOT_CONFIGURED');e.status=503;throw e;}}
function org(project){const id=ORGS[project];if(!id)throw new Error('COMMERCIAL_PROJECT_ORG_NOT_CONFIGURED');return id;}
async function sb(path){requireDb();const r=await fetch(`${SB_URL}/rest/v1/${path}`,{headers:{apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`},signal:AbortSignal.timeout(15000)});const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={raw:text}}if(!r.ok){const e=new Error(data.message||data.error||`SUPABASE_HTTP_${r.status}`);e.status=502;throw e;}return data;}
export default async function handler(req,res){
  if(!auth(req))return noauth(res);
  if(req.method!=='GET')return res.status(405).json({error:'METHOD'});
  try{
    const project=projectKey(req.query?.project||'jihoceske');
    const organization_id=org(project);
    const [quotes,jobs,financial,opportunities]=await Promise.all([
      sb(`quotes?organization_id=eq.${organization_id}&select=id,quote_number,contact_id,opportunity_id,status,subtotal,tax,total,currency,valid_until,issued_at,accepted_at,notes,created_at,updated_at&order=created_at.desc&limit=200`),
      sb(`jobs?organization_id=eq.${organization_id}&select=id,contact_id,title,address,status,scheduled_at,note,price,direct_cost,created_at,updated_at&order=created_at.desc&limit=200`),
      sb(`financial_entries?organization_id=eq.${organization_id}&select=id,entry_type,category,amount,currency,occurred_on,status,counterparty,reference,note,job_id,opportunity_id,created_at&order=occurred_on.desc&limit=300`),
      sb(`opportunities?organization_id=eq.${organization_id}&select=id,contact_id,title,stage,priority,value,probability,source,next_action,next_action_at,notes,owner_user_id,created_at,updated_at&order=created_at.desc&limit=200`)
    ]);
    const rows=a=>Array.isArray(a)?a:[];
    const q=rows(quotes),j=rows(jobs),f=rows(financial),o=rows(opportunities);
    const income=f.filter(x=>String(x.entry_type).toLowerCase()==='income').reduce((s,x)=>s+Number(x.amount||0),0);
    const expense=f.filter(x=>String(x.entry_type).toLowerCase()==='expense').reduce((s,x)=>s+Number(x.amount||0),0);
    const openQuotes=q.filter(x=>!['accepted','rejected','expired','cancelled'].includes(String(x.status||'').toLowerCase()));
    const activeJobs=j.filter(x=>!['done','completed','cancelled','closed'].includes(String(x.status||'').toLowerCase()));
    return res.json({ok:true,verified:true,project,organization_id,source:'supabase',commercial:{quotes:q,jobs:j,financial_entries:f,opportunities:o,summary:{quoteCount:q.length,openQuoteCount:openQuotes.length,jobCount:j.length,activeJobCount:activeJobs.length,opportunityCount:o.length,income,expense,netCash:income-expense}}});
  }catch(e){return sendError(res,e);}
}
