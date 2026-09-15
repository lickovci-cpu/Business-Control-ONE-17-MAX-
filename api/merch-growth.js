import {auth,noauth,body,sendError,env,fetchJsonWithRetry} from './_lib.js';

const ORG='d2751286-da99-42c0-b8ac-6a2da8ecdabf';
const SB_URL=env('SUPABASE_URL','https://vjzzvopwecmwuccdidzq.supabase.co');
const prospectFields='id,organization_id,company_name,domain,contact_name,email,phone,source,source_url,fit_score,status,notes,metadata,created_at,updated_at,last_contact_at,next_action_at';
const draftFields='id,organization_id,prospect_id,channel,subject,body,personalization,status,created_at,updated_at,approved_at,sent_at';
const creativeFields='id,organization_id,prospect_id,product_id,provider,prompt,image_url,preview_url,variant,score,status,metadata,created_at,selected_at';
function clean(v,max=1000){return String(v??'').trim().slice(0,max)}
function intScore(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):null}
function okStatus(v,list){return list.includes(v)}
function sb(){const key=env('SUPABASE_SERVICE_ROLE_KEY')||env('SUPABASE_SERVICE_KEY');if(!key)throw Object.assign(new Error('SUPABASE_SERVICE_ROLE_KEY_NOT_CONFIGURED'),{status:503});return {key};}
async function query(path,params={},method='GET',payload){const {key}=sb();const u=new URL(`${SB_URL}/rest/v1/${path}`);for(const[k,v]of Object.entries(params))u.searchParams.set(k,String(v));const opt={method,headers:{apikey:key,Authorization:`Bearer ${key}`,'content-type':'application/json',Prefer:'return=representation'},...(payload===undefined?{}:{body:JSON.stringify(payload)})};return fetchJsonWithRetry(u,opt,2)}

export default async function handler(req,res){
 if(!auth(req))return noauth(res);
 try{
  const action=clean(req.query.action||'dashboard',80);
  if(req.method==='GET'){
   if(action==='dashboard'){
    const [p,d,c]=await Promise.all([query('merch_prospects',{organization_id:`eq.${ORG}`,select:prospectFields,order:'fit_score.desc,created_at.desc',limit:100}),query('merch_outreach_drafts',{organization_id:`eq.${ORG}`,select:draftFields,order:'created_at.desc',limit:100}),query('merch_creative_proposals',{organization_id:`eq.${ORG}`,select:creativeFields,order:'created_at.desc',limit:100})]);
    return res.json({ok:true,prospects:p||[],outreach:d||[],creatives:c||[]});
   }
   const map={prospects:['merch_prospects',prospectFields],outreach:['merch_outreach_drafts',draftFields],creatives:['merch_creative_proposals',creativeFields]};
   if(map[action]){const [table,select]=map[action],rows=await query(table,{organization_id:`eq.${ORG}`,select,order:'created_at.desc',limit:200});return res.json({ok:true,[action]:rows||[]})}
   return res.status(400).json({error:'UNKNOWN_ACTION'});
  }
  if(req.method!=='POST')return res.status(405).json({error:'METHOD'});
  const b=await body(req);
  if(action==='prospect'){
   const email=clean(b.email,320).toLowerCase();
   const row={organization_id:ORG,company_name:clean(b.company_name,240)||null,domain:clean(b.domain,253).toLowerCase()||null,contact_name:clean(b.contact_name,240)||null,email:email||null,phone:clean(b.phone,80)||null,source:clean(b.source,120)||'manual',source_url:clean(b.source_url,500)||null,fit_score:intScore(b.fit_score),status:okStatus(b.status,['discovered','qualified','draft_ready','approved','contacted','replied','converted','rejected','suppressed'])?b.status:'discovered',notes:clean(b.notes,4000)||null,metadata:b.metadata&&typeof b.metadata==='object'?b.metadata:{}};
   const rows=await query('merch_prospects',{on_conflict:'organization_id,email'},'POST',row);return res.status(201).json({ok:true,prospect:Array.isArray(rows)?rows[0]:rows});
  }
  if(action==='outreach-draft'){
   const prospectId=clean(b.prospect_id,80),channel=clean(b.channel,40).toLowerCase(),text=clean(b.body,12000);if(!prospectId||!text)return res.status(400).json({error:'MISSING_PROSPECT_OR_BODY'});if(!['email','whatsapp','instagram','facebook','other'].includes(channel))return res.status(400).json({error:'INVALID_CHANNEL'});
   const row={organization_id:ORG,prospect_id:prospectId,channel,subject:clean(b.subject,998)||null,body:text,personalization:b.personalization&&typeof b.personalization==='object'?b.personalization:{},status:'draft'};const rows=await query('merch_outreach_drafts',{},'POST',row);return res.status(201).json({ok:true,draft:Array.isArray(rows)?rows[0]:rows,requires_approval:true});
  }
  if(action==='creative-batch'){
   const items=Array.isArray(b.items)?b.items.slice(0,5):[];if(!items.length)return res.status(400).json({error:'CREATIVE_BATCH_REQUIRES_ITEMS'});const rows=items.map((x,i)=>({organization_id:ORG,prospect_id:clean(b.prospect_id,80)||null,product_id:clean(b.product_id,80)||null,provider:clean(x.provider,120)||`provider-${i+1}`,prompt:clean(x.prompt,8000),image_url:clean(x.image_url,2000)||null,preview_url:clean(x.preview_url,2000)||null,variant:clean(x.variant,200)||null,score:intScore(x.score),status:'candidate',metadata:x.metadata&&typeof x.metadata==='object'?x.metadata:{}}));if(rows.some(x=>!x.prompt))return res.status(400).json({error:'CREATIVE_PROMPT_REQUIRED'});const data=await query('merch_creative_proposals',{},'POST',rows);return res.status(201).json({ok:true,creatives:data||[],selection_required:true,max_selection:1,requires_approval:true});
  }
  if(action==='select-creative'){
   const id=clean(b.id,80);if(!id)return res.status(400).json({error:'MISSING_ID'});const chosen=(await query('merch_creative_proposals',{id:`eq.${id}`,organization_id:`eq.${ORG}`,select:creativeFields,limit:1}))[0];if(!chosen)return res.status(404).json({error:'NOT_FOUND'});if(!['candidate','selected'].includes(chosen.status))return res.status(409).json({error:'CREATIVE_NOT_SELECTABLE'});if(chosen.prospect_id)await query('merch_creative_proposals',{organization_id:`eq.${ORG}`,prospect_id:`eq.${chosen.prospect_id}`,status:'eq.selected',id:`neq.${id}`},'PATCH',{status:'rejected'});const data=await query('merch_creative_proposals',{id:`eq.${id}`,organization_id:`eq.${ORG}`},'PATCH',{status:'selected',selected_at:new Date().toISOString()});return res.json({ok:true,creative:Array.isArray(data)?data[0]:data,requires_approval:true});
  }
  if(action==='set-outreach-status'){
   const id=clean(b.id,80),status=clean(b.status,40);if(!id||!okStatus(status,['draft','approved','sent','rejected','cancelled']))return res.status(400).json({error:'INVALID_STATUS'});const patch={status};if(status==='approved')patch.approved_at=new Date().toISOString();if(status==='sent')patch.sent_at=new Date().toISOString();const data=await query('merch_outreach_drafts',{id:`eq.${id}`,organization_id:`eq.${ORG}`},'PATCH',patch);return res.json({ok:true,draft:Array.isArray(data)?data[0]:data});
  }
  return res.status(400).json({error:'UNKNOWN_ACTION'});
 }catch(e){return sendError(res,e)}
}
