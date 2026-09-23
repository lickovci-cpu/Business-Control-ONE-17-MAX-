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
function token(req){const h=String(req.headers?.authorization||'');if(h.startsWith('Bearer '))return h.slice(7).trim();return String(req.headers?.['x-bco-integration-key']||'').trim();}
function authenticate(req){return !!INTEGRATION_SECRET&&safeEqual(token(req),INTEGRATION_SECRET);}
function hash(v){return createHash('sha256').update(JSON.stringify(v)).digest('hex');}
async function sb(path,opt={}){requireConfig();const r=await fetch(`${SB_URL}/rest/v1/${path}`,{...opt,headers:{apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`,'content-type':'application/json',...(opt.headers||{})},signal:AbortSignal.timeout(15000)});const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={raw:text};}if(!r.ok){const e=new Error(data.message||data.error||`SUPABASE_HTTP_${r.status}`);e.status=502;throw e;}return data;}
function clean(v,max=500){return String(v??'').trim().slice(0,max);}
function organization(project){const id=ORGS[project];if(!id)throw new Error('PROJECT_ORG_NOT_CONFIGURED');return id;}
async function dedupe(project,eventType,eventId,payload,organizationId){const dedupeKey=`web:${project}:${eventType}:${eventId||hash(payload)}`.slice(0,240);const existing=await sb(`webhook_events?dedupe_key=eq.${encodeURIComponent(dedupeKey)}&select=id&limit=1`);if(existing?.length)return {duplicate:true,dedupeKey,referenceId:String(existing[0].id)};const row=await sb('webhook_events',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({organization_id:organizationId,provider:`website:${project}`,event_type:eventType,dedupe_key:dedupeKey,payload})});return {duplicate:false,dedupeKey,referenceId:String(row?.[0]?.id||row?.id||dedupeKey)};}
async function upsertContact(project,payload,organizationId){const name=clean(payload.contact?.name||payload.name,200);const phone=clean(payload.contact?.phone||payload.phone,80);const email=clean(payload.contact?.email||payload.email,240).toLowerCase();if(!name&&!phone&&!email)throw new Error('CONTACT_DATA_REQUIRED');let rows=[];if(phone)rows=await sb(`contacts?organization_id=eq.${organizationId}&phone=eq.${encodeURIComponent(phone)}&select=id,name,phone,email&limit=1`);if(!rows.length&&email)rows=await sb(`contacts?organization_id=eq.${organizationId}&email=eq.${encodeURIComponent(email)}&select=id,name,phone,email&limit=1`);if(rows.length)return rows[0];const created=await sb('contacts',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({organization_id:organizationId,name:name||null,phone:phone||null,email:email||null})});return Array.isArray(created)?created[0]:created;}
async function findLead(organizationId,contactId){if(!contactId)return null;const rows=await sb(`leads?organization_id=eq.${organizationId}&contact_id=eq.${contactId}&status=not.in.(closed,lost,paid)&order=created_at.desc&select=id,status&limit=1`);return rows?.[0]||null;}
async function ingestLead(project,payload,organizationId,event){const contact=await upsertContact(project,payload,organizationId);const note=[clean(payload.note,800),payload.service?`Služba: ${clean(payload.service,200)}`:'',payload.location?`Lokalita: ${clean(payload.location,200)}`:'',payload.page_url?`Web: ${clean(payload.page_url,500)}`:'',`Webhook: ${event.dedupeKey}`].filter(Boolean).join(' · ');const lead=await sb('leads',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({organization_id:organizationId,contact_id:contact?.id||null,status:'new',estimated_value:payload.estimated_value??null,note:note||null,source:clean(payload.source||`web:${project}`,120)})});const result=Array.isArray(lead)?lead[0]:lead;return {entityType:'lead',referenceId:String(result?.id||''),contactId:String(contact?.id||''),created:true};}
async function ingestMessage(project,payload,organizationId,ensureLead=false){
  const contact=await upsertContact(project,payload,organizationId);
  const phone=clean(payload.phone||payload.contact?.phone,80);
  if(!phone&&!payload.body)throw new Error('MESSAGE_DATA_REQUIRED');

  let lead=await findLead(organizationId,contact?.id);
  if(!lead&&ensureLead){
    const note=[
      clean(payload.note,800),
      clean(payload.body,1200),
      payload.page_url?`Web: ${clean(payload.page_url,500)}`:'',
      `Inquiry from ${clean(payload.source||`web:${project}`,120)}`
    ].filter(Boolean).join(' · ');
    const createdLead=await sb('leads',{
      method:'POST',
      headers:{Prefer:'return=representation'},
      body:JSON.stringify({
        organization_id:organizationId,
        contact_id:contact?.id||null,
        status:'new',
        estimated_value:payload.estimated_value??null,
        note:note||null,
        source:clean(payload.source||`web:${project}`,120)
      })
    });
    lead=Array.isArray(createdLead)?createdLead[0]:createdLead;
  }

  let conversations=phone?await sb(`conversations?organization_id=${organizationId}&phone=${encodeURIComponent(phone)}&status=eq.open&order=updated_at.desc&select=id&limit=1`):[];
  let conversation=conversations?.[0];
  if(!conversation){
    const created=await sb('conversations',{
      method:'POST',
      headers:{Prefer:'return=representation'},
      body:JSON.stringify({
        organization_id:organizationId,
        contact_id:contact?.id||null,
        phone:phone||'',
        source:clean(payload.source||`web:${project}`,120),
        status:'open'
      })
    });
    conversation=Array.isArray(created)?created[0]:created;
  }

  const msg=await sb('messages',{
    method:'POST',
    headers:{Prefer:'return=representation'},
    body:JSON.stringify({
      organization_id:organizationId,
      conversation_id:conversation?.id||null,
      direction:'in',
      channel:clean(payload.channel||'web',30),
      phone:phone||null,
      body:clean(payload.body||payload.message,12000),
      provider:clean(payload.provider||`website:${project}`,80),
      provider_message_id:clean(payload.message_id||payload.idempotency_key||'',180)||null,
      status:'received'
    })
  });
  return {entityType:'message',referenceId:String(msg?.[0]?.id||msg?.id||''),conversationId:String(conversation?.id||''),contactId:String(contact?.id||''),leadId:String(lead?.id||''),created:true};
}
async function ingestOrder(project,payload,organizationId){const contact=await upsertContact(project,payload,organizationId);const lead=await findLead(organizationId,contact?.id);const items=Array.isArray(payload.items)?payload.items:[];if(!items.length)throw new Error('ORDER_ITEMS_REQUIRED');const subtotal=Number(payload.subtotal??items.reduce((s,x)=>s+(Number(x.quantity||1)*Number(x.unit_price??x.price??0)),0));const shipping=Number(payload.shipping||0);const total=Number(payload.total??subtotal+shipping);if(!Number.isFinite(subtotal)||subtotal<0||!Number.isFinite(total)||total<0)throw new Error('INVALID_ORDER_TOTAL');const orderNumber=clean(payload.order_number||`NRS-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${Math.random().toString(36).slice(2,7).toUpperCase()}`,40);const created=await sb('merch_orders',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({organization_id:organizationId,contact_id:contact?.id||null,lead_id:lead?.id||null,order_number:orderNumber,status:'new',source:clean(payload.source||`web:${project}`,120),currency:clean(payload.currency||'CZK',8),subtotal,shipping,total,customer_note:clean(payload.customer_note||payload.note,2000)||null,shipping_data:(payload.shipping_data&&typeof payload.shipping_data==='object')?payload.shipping_data:{},metadata:{external_order_id:clean(payload.order_id||'',180)}})});const order=Array.isArray(created)?created[0]:created;for(const item of items){const quantity=Number(item.quantity||1),unitPrice=Number(item.unit_price??item.price??0);await sb('merch_order_items',{method:'POST',body:JSON.stringify({organization_id:organizationId,order_id:order.id,product_id:item.product_id||null,product_name:clean(item.product_name||item.name||'Merch',300),sku:clean(item.sku,100)||null,variant:(item.variant&&typeof item.variant==='object')?item.variant:{},quantity,unit_price:unitPrice,line_total:Number(item.line_total??quantity*unitPrice)})});}return {entityType:'merch_order',referenceId:String(order?.id||''),orderNumber,contactId:String(contact?.id||''),leadId:String(lead?.id||''),created:true};}

export default async function handler(req,res){if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});try{if(!authenticate(req))return res.status(401).json({error:'INTEGRATION_AUTH_REQUIRED'});const b=await body(req,EVENT_LIMIT);const project=projectKey(b.project||'');if(!PROJECTS.has(project))throw new Error('PROJECT_NOT_INTEGRATION_ALLOWLIST');const eventType=clean(b.event_type||b.type,80).toLowerCase();const eventId=clean(b.event_id||b.idempotency_key||'',180);const payload=(b.payload&&typeof b.payload==='object')?b.payload:b;const organizationId=organization(project);if(!eventType)throw new Error('EVENT_TYPE_REQUIRED');const event=await dedupe(project,eventType,eventId,payload,organizationId);if(event.duplicate)return res.status(200).json({ok:true,verified:true,duplicate:true,project,eventType,referenceId:event.referenceId});let result={entityType:'event',referenceId:event.referenceId,created:false};if(['lead.created','lead.submitted','contact.created'].includes(eventType))result=await ingestLead(project,payload,organizationId,event);else if(['message.created','message.received'].includes(eventType))result=await ingestMessage(project,payload,organizationId,false);else if(eventType==='inquiry.created')result=await ingestMessage(project,payload,organizationId,true);else if(['order.created','checkout.created'].includes(eventType)){if(project!=='merch')throw new Error('ORDER_PROJECT_NOT_ALLOWED');result=await ingestOrder(project,payload,organizationId);}return res.status(202).json({ok:true,verified:true,project,eventType,referenceId:event.referenceId,result});}catch(e){console.error('BCO_WEBHOOK_ERROR',JSON.stringify({status:e?.status||500,message:String(e?.message||'UNKNOWN_ERROR').slice(0,300)}));return sendError(res,e);}}
