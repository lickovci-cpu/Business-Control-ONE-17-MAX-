import {createHash} from 'node:crypto';
import {body,projectKey,sendError,safeEqual} from '../_lib.js';

const SB_URL=process.env.SUPABASE_URL||'https://vjzzvopwecmwuccdidzq.supabase.co';
const SB_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||'';
const INTEGRATION_SECRET=process.env.BCO_INTEGRATION_SECRET||'';
const ORGS={
  jihoceske:'09fb6fc9-7ea9-46ac-a84b-bd9952784c0c',
  merch:'d2751286-da99-42c0-b8ac-6a2da8ecdabf'
};
const PROJECTS=new Set(Object.keys(ORGS));
const EVENT_LIMIT=200000;

function requireConfig(){
  if(!INTEGRATION_SECRET){const e=new Error('BCO_INTEGRATION_SECRET_NOT_CONFIGURED');e.status=503;throw e;}
  if(!SB_KEY){const e=new Error('CRM_DB_NOT_CONFIGURED');e.status=503;throw e;}
}
function token(req){
  const h=String(req.headers?.authorization||'');
  if(h.startsWith('Bearer '))return h.slice(7).trim();
  return String(req.headers?.['x-bco-integration-key']||'').trim();
}
function authenticate(req){return !!INTEGRATION_SECRET&&safeEqual(token(req),INTEGRATION_SECRET);}
function hash(v){return createHash('sha256').update(JSON.stringify(v)).digest('hex');}
async function sb(path,opt={}){
  requireConfig();
  const r=await fetch(`${SB_URL}/rest/v1/${path}`,{...opt,headers:{apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`,'content-type':'application/json',...(opt.headers||{})},signal:AbortSignal.timeout(15000)});
  const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={raw:text};}
  if(!r.ok){const e=new Error(data.message||data.error||`SUPABASE_HTTP_${r.status}`);e.status=502;throw e;}
  return data;
}
function clean(v,max=500){return String(v??'').trim().slice(0,max);}
function organization(project){const id=ORGS[project];if(!id)throw new Error('PROJECT_ORG_NOT_CONFIGURED');return id;}

async function dedupe(project,eventType,eventId,payload,organizationId){
  const dedupeKey=`web:${project}:${eventType}:${eventId||hash(payload)}`.slice(0,240);
  const existing=await sb(`webhook_events?dedupe_key=eq.${encodeURIComponent(dedupeKey)}&select=id&limit=1`);
  if(existing?.length)return {duplicate:true,dedupeKey,referenceId:String(existing[0].id)};
  const row=await sb('webhook_events',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({organization_id:organizationId,provider:`website:${project}`,event_type:eventType,dedupe_key:dedupeKey,payload})});
  return {duplicate:false,dedupeKey,referenceId:String(row?.[0]?.id||row?.id||dedupeKey)};
}

async function upsertContact(project,payload,organizationId){
  const name=clean(payload.contact?.name||payload.name,200);
  const phone=clean(payload.contact?.phone||payload.phone,80);
  const email=clean(payload.contact?.email||payload.email,240).toLowerCase();
  if(!name&&!phone&&!email)throw new Error('CONTACT_DATA_REQUIRED');
  let rows=[];
  if(phone)rows=await sb(`contacts?organization_id=eq.${organizationId}&phone=eq.${encodeURIComponent(phone)}&select=id,name,phone,email&limit=1`);
  if(!rows.length&&email)rows=await sb(`contacts?organization_id=eq.${organizationId}&email=eq.${encodeURIComponent(email)}&select=id,name,phone,email&limit=1`);
  if(rows.length)return rows[0];
  const created=await sb('contacts',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({organization_id:organizationId,name:name||null,phone:phone||null,email:email||null})});
  return Array.isArray(created)?created[0]:created;
}

async function ingestLead(project,payload,organizationId,event){
  const contact=await upsertContact(project,payload,organizationId);
  const note=[
    clean(payload.note,800),
    payload.service?`Služba: ${clean(payload.service,200)}`:'',
    payload.location?`Lokalita: ${clean(payload.location,200)}`:'',
    payload.page_url?`Web: ${clean(payload.page_url,500)}`:'',
    `Webhook: ${event.dedupeKey}`
  ].filter(Boolean).join(' · ');
  const lead=await sb('leads',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({organization_id:organizationId,contact_id:contact?.id||null,status:'new',estimated_value:payload.estimated_value??null,note:note||null,source:clean(payload.source||`web:${project}`,120)})});
  const result=Array.isArray(lead)?lead[0]:lead;
  return {entityType:'lead',referenceId:String(result?.id||''),contactId:String(contact?.id||''),created:true};
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{
    if(!authenticate(req))return res.status(401).json({error:'INTEGRATION_AUTH_REQUIRED'});
    const b=await body(req,EVENT_LIMIT);
    const project=projectKey(b.project||'');
    if(!PROJECTS.has(project))throw new Error('PROJECT_NOT_INTEGRATION_ALLOWLIST');
    const eventType=clean(b.event_type||b.type,80).toLowerCase();
    const eventId=clean(b.event_id||b.idempotency_key||'',180);
    const payload=(b.payload&&typeof b.payload==='object')?b.payload:b;
    const organizationId=organization(project);
    if(!eventType)throw new Error('EVENT_TYPE_REQUIRED');
    const event=await dedupe(project,eventType,eventId,payload,organizationId);
    if(event.duplicate)return res.status(200).json({ok:true,verified:true,duplicate:true,project,eventType,referenceId:event.referenceId});
    let result={entityType:'event',referenceId:event.referenceId,created:false};
    if(eventType==='lead.created'||eventType==='lead.submitted'||eventType==='contact.created')result=await ingestLead(project,payload,organizationId,event);
    else if(eventType==='order.created'||eventType==='checkout.created'){
      result={entityType:'order_event',referenceId:event.referenceId,created:false,action:'ledgered_only',reason:'Commerce order schema is not yet verified for this project'};
    }
    return res.status(202).json({ok:true,verified:true,project,eventType,referenceId:event.referenceId,result});
  }catch(e){
    console.error('BCO_WEBHOOK_ERROR',JSON.stringify({status:e?.status||500,message:String(e?.message||'UNKNOWN_ERROR').slice(0,300)}));
    return sendError(res,e);
  }
}
