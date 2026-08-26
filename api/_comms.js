import {createSign,randomUUID} from 'node:crypto';
import {env} from './_lib.js';

function b64url(v){return Buffer.from(v).toString('base64url');}
class ProviderError extends Error{constructor(message,{status=0,retryable=false,uncertain=false}={}){super(message);this.status=status;this.retryable=retryable;this.uncertain=uncertain;}}
const gmailCache={token:null,exp:0},rcsCache={token:null,exp:0};
const nowSec=()=>Math.floor(Date.now()/1000);

async function gmailAccessToken(){
  if(gmailCache.token&&gmailCache.exp>nowSec()+300)return gmailCache.token;
  const clientId=env('GMAIL_CLIENT_ID'),clientSecret=env('GMAIL_CLIENT_SECRET'),refreshToken=env('GMAIL_REFRESH_TOKEN');
  if(!clientId||!clientSecret||!refreshToken)throw new Error('Gmail OAuth není nastaven.');
  const form=new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:refreshToken,grant_type:'refresh_token'});
  let r;try{r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form})}catch(e){throw new ProviderError('Gmail OAuth síťová chyba.',{uncertain:false,retryable:true})}
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new ProviderError(j.error_description||j.error||'Gmail OAuth error',{status:r.status,retryable:r.status===429||r.status>=500});
  gmailCache.token=j.access_token;gmailCache.exp=nowSec()+Number(j.expires_in||3600);return gmailCache.token;
}

function mime({to,subject,text,from}){const clean=s=>String(s||'').replace(/[\r\n]+/g,' ');return [`From: ${clean(from)}`,`To: ${clean(to)}`,`Subject: ${clean(subject)}`,'MIME-Version: 1.0','Content-Type: text/plain; charset="UTF-8"','Content-Transfer-Encoding: 8bit','',String(text||'')].join('\r\n');}
function validatePhone(v){const s=String(v||'').replace(/[\s()-]/g,'');if(!/^\+?[1-9]\d{7,14}$/.test(s))throw new Error('Telefon musí být v mezinárodním formátu, např. +420...');return s.startsWith('+')?s:`+${s}`;}
async function sendFetch(url,opt,label){
  let r;try{r=await fetch(url,opt)}catch{throw new ProviderError(`${label}: síťová chyba, stav doručení není jistý.`,{uncertain:true})}
  const text=await r.text();let j={};try{j=JSON.parse(text)}catch{j={raw:text}};
  if(!r.ok)throw new ProviderError(j.error?.message||j.error_description||text||`${label} failed`,{status:r.status,retryable:r.status===429||r.status>=500,uncertain:false});
  return j;
}

export async function sendEmail(msg){
  const from=env('GMAIL_FROM');if(!from)throw new Error('GMAIL_FROM není nastaven.');if(!msg.to)throw new Error('Chybí e-mail příjemce.');
  const token=await gmailAccessToken(),raw=Buffer.from(mime({to:msg.to,subject:msg.subject||'',text:msg.text||'',from}),'utf8').toString('base64url');
  const j=await sendFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({raw})},'Gmail send');
  return {channel:'email',id:j.id,threadId:j.threadId};
}

export async function sendWhatsApp(msg){
  const token=env('WHATSAPP_ACCESS_TOKEN'),phoneId=env('WHATSAPP_PHONE_NUMBER_ID'),v=env('META_GRAPH_VERSION','v24.0');
  if(!token||!phoneId)throw new Error('WhatsApp Cloud API není nastaven.');const to=validatePhone(msg.to).replace('+','');
  let payload={messaging_product:'whatsapp',recipient_type:'individual',to};
  if(msg.templateName)payload={...payload,type:'template',template:{name:msg.templateName,language:{code:msg.templateLanguage||'cs'},components:msg.templateComponents||[]}};
  else payload={...payload,type:'text',text:{preview_url:!!msg.previewUrl,body:String(msg.text||'')}};
  const j=await sendFetch(`https://graph.facebook.com/${v}/${phoneId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(payload)},'WhatsApp send');
  return {channel:'whatsapp',id:j.messages?.[0]?.id||null,response:j};
}

async function rcsAccessToken(){
  if(rcsCache.token&&rcsCache.exp>nowSec()+300)return rcsCache.token;
  const raw=env('RCS_SERVICE_ACCOUNT_JSON');if(!raw)throw new Error('RCS_SERVICE_ACCOUNT_JSON není nastaven.');
  let sa;try{sa=JSON.parse(raw)}catch{throw new Error('RCS_SERVICE_ACCOUNT_JSON není platný JSON.');}
  if(!sa.client_email||!sa.private_key)throw new Error('RCS service account nemá client_email/private_key.');
  const now=nowSec(),header=b64url(JSON.stringify({alg:'RS256',typ:'JWT'})),claims=b64url(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/rcsbusinessmessaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
  const unsigned=`${header}.${claims}`,signer=createSign('RSA-SHA256');signer.update(unsigned);signer.end();const sig=signer.sign(sa.private_key).toString('base64url');
  const form=new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${unsigned}.${sig}`});
  let r;try{r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form})}catch{throw new ProviderError('RCS OAuth síťová chyba.',{retryable:true})}
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new ProviderError(j.error_description||j.error||'RCS OAuth error',{status:r.status,retryable:r.status===429||r.status>=500});
  rcsCache.token=j.access_token;rcsCache.exp=now+Number(j.expires_in||3600);return rcsCache.token;
}

export async function sendRcs(msg){
  const agentId=env('RCS_AGENT_ID'),region=env('RCS_REGION','europe');if(!['europe','us','asia'].includes(region))throw new Error('RCS_REGION musí být europe, us nebo asia.');
  if(!agentId)throw new Error('RCS_AGENT_ID není nastaven.');const to=validatePhone(msg.to),text=String(msg.text||'');if(text.length>3072)throw new Error('RCS text může mít maximálně 3072 znaků.');
  const token=await rcsAccessToken(),id=msg.messageId||randomUUID(),host=env('RCS_USE_GLOBAL_ENDPOINT','false')==='true'?'rcsbusinessmessaging.googleapis.com':`${region}-rcsbusinessmessaging.googleapis.com`,url=`https://${host}/v1/phones/${encodeURIComponent(to)}/agentMessages?messageId=${encodeURIComponent(id)}&agentId=${encodeURIComponent(agentId)}`;
  const payload={contentMessage:{text},messageTrafficType:msg.trafficType||'SERVICEREQUEST'};
  const j=await sendFetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(payload)},'RCS send');return {channel:'rcs',id,response:j};
}

export async function sendCommunication(msg){const channel=String(msg.channel||'email').toLowerCase();if(channel==='email')return sendEmail(msg);if(channel==='whatsapp')return sendWhatsApp(msg);if(channel==='rcs')return sendRcs(msg);throw new Error('Nepodporovaný kanál.');}
export function commsStatus(){return {email:!!(env('GMAIL_CLIENT_ID')&&env('GMAIL_CLIENT_SECRET')&&env('GMAIL_REFRESH_TOKEN')&&env('GMAIL_FROM')),whatsapp:!!(env('WHATSAPP_ACCESS_TOKEN')&&env('WHATSAPP_PHONE_NUMBER_ID')),rcs:!!(env('RCS_SERVICE_ACCOUNT_JSON')&&env('RCS_AGENT_ID')),rcsRegion:env('RCS_REGION','europe'),rcsEndpoint:env('RCS_USE_GLOBAL_ENDPOINT','false')==='true'?'global':'regional'};}
export {ProviderError};
