import {createCipheriv,createDecipheriv,createHmac,randomBytes} from 'node:crypto';
import {env,supabaseBaseUrl,supabaseRequestCredentials,safeEqual} from './_lib.js';

const now=()=>Math.floor(Date.now()/1000);
const b64=v=>Buffer.from(v).toString('base64url');
function encryptionKey(){
  const raw=env('OUTLOOK_TOKEN_ENCRYPTION_KEY');
  if(!raw)throw new Error('OUTLOOK_TOKEN_ENCRYPTION_KEY_NOT_SET');
  const key=Buffer.from(raw,'base64');
  if(key.length!==32)throw new Error('OUTLOOK_TOKEN_ENCRYPTION_KEY_MUST_BE_32_BYTE_BASE64');
  return key;
}
function encrypt(value){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
  const ciphertext=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return {credential_ciphertext:ciphertext.toString('base64'),credential_iv:iv.toString('base64'),credential_tag:cipher.getAuthTag().toString('base64')};
}
function decrypt(row){
  const decipher=createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(row.credential_iv,'base64'));
  decipher.setAuthTag(Buffer.from(row.credential_tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(row.credential_ciphertext,'base64')),decipher.final()]).toString('utf8');
}
function stateSecret(){const s=env('OUTLOOK_STATE_SECRET');if(!s)throw new Error('OUTLOOK_STATE_SECRET_NOT_SET');return s;}
export function createOutlookState(organizationId){
  const payload=b64(JSON.stringify({organizationId,iat:now(),nonce:randomBytes(16).toString('hex')}));
  const sig=createHmac('sha256',stateSecret()).update(payload).digest('base64url');
  return payload+'.'+sig;
}
export function verifyOutlookState(state){
  const [payload,sig,...rest]=String(state||'').split('.');
  if(!payload||!sig||rest.length)throw new Error('OUTLOOK_STATE_INVALID');
  const expected=createHmac('sha256',stateSecret()).update(payload).digest('base64url');
  if(!safeEqual(sig,expected))throw new Error('OUTLOOK_STATE_INVALID');
  const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
  if(!data.organizationId||!data.iat||now()-data.iat>600||data.iat>now()+60)throw new Error('OUTLOOK_STATE_EXPIRED');
  return data;
}
function config(){
  const clientId=env('OUTLOOK_CLIENT_ID'),clientSecret=env('OUTLOOK_CLIENT_SECRET'),tenant=env('OUTLOOK_TENANT_ID','common'),redirectUri=env('OUTLOOK_REDIRECT_URI');
  if(!clientId||!clientSecret||!redirectUri)throw new Error('OUTLOOK_OAUTH_CONFIG_INCOMPLETE');
  return {clientId,clientSecret,tenant,redirectUri};
}
export function outlookAuthorizationUrl(state){
  const c=config(),u=new URL('https://login.microsoftonline.com/'+encodeURIComponent(c.tenant)+'/oauth2/v2.0/authorize');
  u.search=new URLSearchParams({client_id:c.clientId,response_type:'code',redirect_uri:c.redirectUri,response_mode:'query',scope:'openid profile offline_access User.Read Mail.Send',state}).toString();
  return u.toString();
}
async function tokenRequest(params){
  const c=config(),form=new URLSearchParams({...params,client_id:c.clientId,client_secret:c.clientSecret,redirect_uri:c.redirectUri});
  const r=await fetch('https://login.microsoftonline.com/'+encodeURIComponent(c.tenant)+'/oauth2/v2.0/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error('OUTLOOK_TOKEN_EXCHANGE_FAILED_'+r.status);
  return j;
}
export async function exchangeOutlookCode(code){
  if(!code)throw new Error('OUTLOOK_AUTH_CODE_REQUIRED');
  return tokenRequest({grant_type:'authorization_code',code,scope:'openid profile offline_access User.Read Mail.Send'});
}
function dbCredentials(){
  const c=supabaseRequestCredentials();
  if(!c?.apikey||c.mode!=='service')throw new Error('SUPABASE_SERVER_CREDENTIAL_NOT_CONFIGURED');
  return c;
}
async function db(path,options={}){
  const c=dbCredentials(),r=await fetch(supabaseBaseUrl()+'/rest/v1/'+path,{...options,headers:{apikey:c.apikey,authorization:c.authorization,'content-type':'application/json',...(options.headers||{})}});
  const text=await r.text();if(!r.ok)throw new Error('OUTLOOK_CREDENTIAL_STORE_FAILED_'+r.status);
  return text?JSON.parse(text):null;
}
export async function storeOutlookAuthorization(organizationId,token){
  const grantedScopes=String(token.scope||'').toLowerCase().split(/\s+/).filter(Boolean);
  if(!grantedScopes.includes('mail.send'))throw new Error('OUTLOOK_MAIL_SEND_PERMISSION_MISSING');
  if(!token.refresh_token)throw new Error('OUTLOOK_REFRESH_TOKEN_MISSING');
  const sealed=encrypt(token.refresh_token),row={organization_id:organizationId,provider:'microsoft_graph',...sealed,expires_at:new Date(Date.now()+Number(token.expires_in||3600)*1000).toISOString(),scopes:String(token.scope||'').split(' ').filter(Boolean),updated_at:new Date().toISOString()};
  await db('outbound_provider_credentials?on_conflict=organization_id,provider',{method:'POST',headers:{prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(row)});
}
async function refreshToken(organizationId){
  const rows=await db('outbound_provider_credentials?select=*&organization_id=eq.'+encodeURIComponent(organizationId)+'&provider=eq.microsoft_graph&limit=1');
  if(!Array.isArray(rows)||rows.length!==1)throw new Error('OUTLOOK_NOT_CONNECTED');
  const row=rows[0],refresh=decrypt(row),j=await tokenRequest({grant_type:'refresh_token',refresh_token:refresh,scope:'openid profile offline_access User.Read Mail.Send'});
  if(j.refresh_token)await storeOutlookAuthorization(organizationId,j);
  return j.access_token;
}
export async function sendOutlookEmail({organizationId,to,subject,text}){
  if(!organizationId||!to||!text)throw new Error('OUTLOOK_MESSAGE_FIELDS_REQUIRED');
  const token=await refreshToken(organizationId);
  const r=await fetch('https://graph.microsoft.com/v1.0/me/sendMail',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({message:{subject:String(subject||''),body:{contentType:'Text',content:String(text)},toRecipients:[{emailAddress:{address:String(to)}}]},saveToSentItems:true})});
  if(r.status!==202){const j=await r.json().catch(()=>({}));const e=new Error('OUTLOOK_SEND_FAILED_'+r.status);e.status=r.status;e.detail=j.error?.code||'GRAPH_ERROR';throw e;}
  return {provider:'microsoft_graph',accepted:true,id:null};
}
export async function outlookConnectionStatus(organizationId){
  const rows=await db('outbound_provider_credentials?select=id,expires_at,scopes,updated_at&organization_id=eq.'+encodeURIComponent(organizationId)+'&provider=eq.microsoft_graph&limit=1');
  return {connected:Array.isArray(rows)&&rows.length===1,credential:rows?.[0]||null};
}
