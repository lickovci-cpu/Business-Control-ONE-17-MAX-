import {auth,noauth,body,sendError} from './_lib.js';
import {getSupabaseAdmin} from './_supabase.js';

const ORG='d2751286-da99-42c0-b8ac-6a2da8ecdabf';
const prospectFields='id,organization_id,company_name,domain,contact_name,email,phone,source,source_url,fit_score,status,notes,metadata,created_at,updated_at,last_contact_at,next_action_at';
const draftFields='id,organization_id,prospect_id,channel,subject,body,personalization,status,created_at,updated_at,approved_at,sent_at';
const creativeFields='id,organization_id,prospect_id,product_id,provider,prompt,image_url,preview_url,variant,score,status,metadata,created_at,selected_at';

function clean(v,max=1000){return String(v??'').trim().slice(0,max)}
function intScore(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,Math.round(n))):null}
function okStatus(v,list){return list.includes(v)}

export default async function handler(req,res){
  if(!auth(req)) return noauth(res);
  try{
    const sb=getSupabaseAdmin();
    const action=clean(req.query.action||'dashboard',80);
    if(req.method==='GET'){
      if(action==='dashboard'){
        const [p,d,c]=await Promise.all([
          sb.from('merch_prospects').select(prospectFields).eq('organization_id',ORG).order('fit_score',{ascending:false}).order('created_at',{ascending:false}).limit(100),
          sb.from('merch_outreach_drafts').select(draftFields).eq('organization_id',ORG).order('created_at',{ascending:false}).limit(100),
          sb.from('merch_creative_proposals').select(creativeFields).eq('organization_id',ORG).order('created_at',{ascending:false}).limit(100)
        ]);
        for(const x of [p,d,c]) if(x.error) throw x.error;
        return res.json({ok:true,prospects:p.data||[],outreach:d.data||[],creatives:c.data||[]});
      }
      if(action==='prospects') return res.json({ok:true,prospects:(await sb.from('merch_prospects').select(prospectFields).eq('organization_id',ORG).order('fit_score',{ascending:false}).limit(200)).data||[]});
      if(action==='outreach') return res.json({ok:true,outreach:(await sb.from('merch_outreach_drafts').select(draftFields).eq('organization_id',ORG).order('created_at',{ascending:false}).limit(200)).data||[]});
      if(action==='creatives') return res.json({ok:true,creatives:(await sb.from('merch_creative_proposals').select(creativeFields).eq('organization_id',ORG).order('created_at',{ascending:false}).limit(200)).data||[]});
      return res.status(400).json({error:'UNKNOWN_ACTION'});
    }
    if(req.method!=='POST') return res.status(405).json({error:'METHOD'});
    const b=await body(req);
    if(action==='prospect'){
      const email=clean(b.email,320).toLowerCase();
      const row={organization_id:ORG,company_name:clean(b.company_name,240)||null,domain:clean(b.domain,253).toLowerCase()||null,contact_name:clean(b.contact_name,240)||null,email:email||null,phone:clean(b.phone,80)||null,source:clean(b.source,120)||'manual',source_url:clean(b.source_url,500)||null,fit_score:intScore(b.fit_score),status:okStatus(b.status,['discovered','qualified','draft_ready','approved','contacted','replied','converted','rejected','suppressed'])?b.status:'discovered',notes:clean(b.notes,4000)||null,metadata:b.metadata&&typeof b.metadata==='object'?b.metadata:{}};
      const {data,error}=await sb.from('merch_prospects').upsert(row,{onConflict:'organization_id,email'}).select(prospectFields).single();
      if(error) throw error; return res.status(201).json({ok:true,prospect:data});
    }
    if(action==='outreach-draft'){
      const prospectId=clean(b.prospect_id,80); if(!prospectId||!clean(b.body,12000)) return res.status(400).json({error:'MISSING_PROSPECT_OR_BODY'});
      const channel=clean(b.channel,40).toLowerCase(); if(!['email','whatsapp','instagram','facebook','other'].includes(channel)) return res.status(400).json({error:'INVALID_CHANNEL'});
      const row={organization_id:ORG,prospect_id:prospectId,channel,subject:clean(b.subject,998)||null,body:clean(b.body,12000),personalization:b.personalization&&typeof b.personalization==='object'?b.personalization:{},status:'draft'};
      const {data,error}=await sb.from('merch_outreach_drafts').insert(row).select(draftFields).single(); if(error) throw error;
      return res.status(201).json({ok:true,draft:data,requires_approval:true});
    }
    if(action==='creative-batch'){
      const prospectId=clean(b.prospect_id,80)||null, productId=clean(b.product_id,80)||null;
      const items=Array.isArray(b.items)?b.items.slice(0,5):[]; if(!items.length) return res.status(400).json({error:'CREATIVE_BATCH_REQUIRES_ITEMS'});
      const rows=items.map((x,i)=>({organization_id:ORG,prospect_id:prospectId,product_id:productId,provider:clean(x.provider,120)||`provider-${i+1}`,prompt:clean(x.prompt,8000),image_url:clean(x.image_url,2000)||null,preview_url:clean(x.preview_url,2000)||null,variant:clean(x.variant,200)||null,score:intScore(x.score),status:'candidate',metadata:x.metadata&&typeof x.metadata==='object'?x.metadata:{}}));
      if(rows.some(x=>!x.prompt)) return res.status(400).json({error:'CREATIVE_PROMPT_REQUIRED'});
      const {data,error}=await sb.from('merch_creative_proposals').insert(rows).select(creativeFields); if(error) throw error;
      return res.status(201).json({ok:true,creatives:data||[],selection_required:true,max_selection:1});
    }
    if(action==='select-creative'){
      const id=clean(b.id,80); if(!id) return res.status(400).json({error:'MISSING_ID'});
      const {data:chosen,error:e1}=await sb.from('merch_creative_proposals').select(creativeFields).eq('id',id).eq('organization_id',ORG).single(); if(e1) throw e1;
      if(chosen.status!=='candidate'&&chosen.status!=='selected') return res.status(409).json({error:'CREATIVE_NOT_SELECTABLE'});
      if(chosen.prospect_id){await sb.from('merch_creative_proposals').update({status:'rejected'}).eq('organization_id',ORG).eq('prospect_id',chosen.prospect_id).neq('id',id).eq('status','selected');}
      const {data,error}=await sb.from('merch_creative_proposals').update({status:'selected',selected_at:new Date().toISOString()}).eq('id',id).eq('organization_id',ORG).select(creativeFields).single(); if(error) throw error;
      return res.json({ok:true,creative:data,requires_approval:true});
    }
    if(action==='set-outreach-status'){
      const id=clean(b.id,80),status=clean(b.status,40); if(!id||!okStatus(status,['draft','approved','sent','rejected','cancelled'])) return res.status(400).json({error:'INVALID_STATUS'});
      const patch={status,approved_at:status==='approved'?new Date().toISOString():undefined,sent_at:status==='sent'?new Date().toISOString():undefined};
      const {data,error}=await sb.from('merch_outreach_drafts').update(patch).eq('id',id).eq('organization_id',ORG).select(draftFields).single(); if(error) throw error;
      return res.json({ok:true,draft:data});
    }
    return res.status(400).json({error:'UNKNOWN_ACTION'});
  }catch(e){return sendError(res,e)}
}
