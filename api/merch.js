import {body,auth,noauth,sendError,projectKey} from './_lib.js';

const SB_URL=process.env.SUPABASE_URL||'https://vjzzvopwecmwuccdidzq.supabase.co';
const SB_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||'';
const ORG='d2751286-da99-42c0-b8ac-6a2da8ecdabf';
const PROJECT='merch';

function requireDb(){if(!SB_KEY){const e=new Error('CRM_DB_NOT_CONFIGURED');e.status=503;throw e;}}
async function sb(path,opt={}){requireDb();const r=await fetch(`${SB_URL}/rest/v1/${path}`,{...opt,headers:{apikey:SB_KEY,Authorization:`Bearer ${SB_KEY}`,'content-type':'application/json',...(opt.headers||{})},signal:AbortSignal.timeout(15000)});const text=await r.text();let data={};try{data=text?JSON.parse(text):{}}catch{data={raw:text};}if(!r.ok){const e=new Error(data.message||data.error||`SUPABASE_HTTP_${r.status}`);e.status=502;throw e;}return data;}
function clean(v,max=500){return String(v??'').trim().slice(0,max);}
function okProject(v){return projectKey(v||PROJECT)===PROJECT;}

export default async function handler(req,res){if(!auth(req))return noauth(res);try{if(!okProject(req.query?.project))return res.status(400).json({error:'INVALID_PROJECT'});const action=String(req.query?.action||'dashboard');
 if(action==='dashboard'){const [products,orders,leads,messages]=await Promise.all([sb(`merch_products?organization_id=eq.${ORG}&select=id,sku,name,collection,active,price,currency,variants,metadata&order=created_at.desc`),sb(`merch_orders?organization_id=eq.${ORG}&select=id,order_number,status,source,currency,subtotal,shipping,total,contact_id,lead_id,customer_note,shipping_data,created_at,updated_at&order=created_at.desc&limit=100`),sb(`leads?organization_id=eq.${ORG}&select=id,status,source,estimated_value,contact_id,created_at,updated_at&order=created_at.desc&limit=100`),sb(`messages?organization_id=eq.${ORG}&direction=eq.in&select=id,conversation_id,phone,body,channel,created_at,status&order=created_at.desc&limit=100`)]);return res.json({ok:true,project:PROJECT,products,orders,leads,messages});}
 if(action==='products')return res.json({ok:true,products:await sb(`merch_products?organization_id=eq.${ORG}&select=*&order=created_at.desc`)});
 if(action==='orders')return res.json({ok:true,orders:await sb(`merch_orders?organization_id=eq.${ORG}&select=*&order=created_at.desc&limit=200`)});
 if(action==='inbox')return res.json({ok:true,messages:await sb(`messages?organization_id=eq.${ORG}&direction=eq.in&select=*&order=created_at.desc&limit=200`)});
 if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 const b=await body(req);if(action==='product'){const row={organization_id:ORG,sku:clean(b.sku,100),name:clean(b.name,300),collection:clean(b.collection,100)||null,description:clean(b.description,2000)||null,active:b.active!==false,price:Number(b.price||0),currency:clean(b.currency||'CZK',8),variants:Array.isArray(b.variants)?b.variants:[],metadata:b.metadata&&typeof b.metadata==='object'?b.metadata:{}};if(!row.sku||!row.name||!Number.isFinite(row.price)||row.price<0)throw new Error('INVALID_PRODUCT');const out=await sb('merch_products',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(row)});return res.status(201).json({ok:true,product:Array.isArray(out)?out[0]:out});}
 if(action==='order-status'){const id=clean(b.id,80),status=clean(b.status,30);const allowed=['new','confirmed','paid','production','ready','shipped','delivered','cancelled','refunded'];if(!id||!allowed.includes(status))throw new Error('INVALID_ORDER_STATUS');const out=await sb(`merch_orders?id=eq.${encodeURIComponent(id)}&organization_id=eq.${ORG}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({status})});return res.json({ok:true,order:Array.isArray(out)?out[0]:out});}
 return res.status(400).json({error:'UNKNOWN_ACTION'});
 }catch(e){return sendError(res,e);}}
