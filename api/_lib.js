import {createHmac,timingSafeEqual,randomBytes} from 'node:crypto';

export const env=(k,d='')=>process.env[k]||d;
const SESSION_COOKIE='bc_session';
const SESSION_TTL=30*24*60*60;

function cookies(req){
  const out={};
  for(const part of String(req.headers?.cookie||'').split(';')){
    const i=part.indexOf('='); if(i<1)continue;
    out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());
  }
  return out;
}
function sessionSecret(){return env('APP_SESSION_SECRET')||env('APP_CONFIRM_SECRET')||env('APP_PASSWORD');}
function signSession(enc){return createHmac('sha256',sessionSecret()).update(enc).digest('base64url');}
export function createSessionToken(){
  if(!sessionSecret())throw new Error('SESSION_SECRET_NOT_CONFIGURED');
  const data={exp:Math.floor(Date.now()/1000)+SESSION_TTL,n:randomBytes(16).toString('base64url')};
  const enc=Buffer.from(JSON.stringify(data)).toString('base64url');
  return `${enc}.${signSession(enc)}`;
}
export function verifySessionToken(token){
  try{
    if(!token||!String(token).includes('.')||!sessionSecret())return false;
    const [enc,sig]=String(token).split('.'),expected=signSession(enc),a=Buffer.from(sig),b=Buffer.from(expected);
    if(a.length!==b.length||!timingSafeEqual(a,b))return false;
    const d=JSON.parse(Buffer.from(enc,'base64url').toString('utf8'));
    return Number(d.exp)>Math.floor(Date.now()/1000);
  }catch{return false;}
}
export function auth(req){
  const p=env('APP_PASSWORD')||env('BCO_API_KEY');
  if(!p)return process.env.NODE_ENV!=='production';
  const c=cookies(req)[SESSION_COOKIE];
  if(verifySessionToken(c))return true;
  // Server-to-server migration path: BCO_API_KEY is accepted only as a request header.
  return safeEqual(String(req.headers?.['x-app-key']||''),p);
}
export function safeEqual(a,b){
  const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));
  return aa.length===bb.length&&timingSafeEqual(aa,bb);
}
export function setSessionCookie(res,token){res.setHeader('Set-Cookie',`${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_TTL}; HttpOnly; Secure; SameSite=Strict`);}
export function clearSessionCookie(res){res.setHeader('Set-Cookie',`${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`);}
export function noauth(res){return res.status(401).json({error:'AUTH_REQUIRED'});}

export async function body(req,maxBytes=3_200_000){
  if(req.body&&typeof req.body==='object'){
    const size=Buffer.byteLength(JSON.stringify(req.body));
    if(size>maxBytes){const e=new Error('REQUEST_TOO_LARGE');e.status=413;throw e;}
    return req.body;
  }
  let s='';let size=0;
  for await(const c of req){size+=c.length;if(size>maxBytes){const e=new Error('REQUEST_TOO_LARGE');e.status=413;throw e;}s+=c;}
  try{return JSON.parse(s||'{}')}catch{const e=new Error('INVALID_JSON');e.status=400;throw e;}
}
export function sendError(res,e,fallback=500){
  const known={AUTH_REQUIRED:401,INVALID_JSON:400,REQUEST_TOO_LARGE:413,METHOD:405,METHOD_NOT_ALLOWED:405,UNKNOWN_ACTION:400,INVALID_PROJECT:400,CONFIRMATION_REQUIRED:400,CONFIRMATION_INVALID:400,CONFIRMATION_EXPIRED:400,CONFIRMATION_PAYLOAD_CHANGED:409};
  return res.status(Number(e?.status)||known[e?.message]||fallback).json({error:e?.message||'INTERNAL_ERROR',code:e?.code||undefined,subcode:e?.subcode||undefined});
}
export function projectKey(v){
  const k=String(v||'jihoceske').toLowerCase();
  if(!['jihoceske','mazliprint','merch','boost','tepovani'].includes(k))throw new Error('INVALID_PROJECT');
  return k;
}

async function kvCommand(command){
  const u=env('KV_REST_API_URL'),t=env('KV_REST_API_TOKEN');
  if(!u||!t)return {configured:false,result:null};
  const r=await fetch(u,{method:'POST',headers:{Authorization:`Bearer ${t}`,'content-type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(10000)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||j.error)throw new Error(j.error||`KV command failed (${r.status})`);
  return {configured:true,result:j.result};
}
export async function kvGet(key){const x=await kvCommand(['GET',String(key)]);if(!x.configured||x.result==null)return null;try{return JSON.parse(x.result)}catch{return x.result}}
export async function kvSet(key,val){const x=await kvCommand(['SET',String(key),JSON.stringify(val)]);return x.configured&&x.result==='OK';}
export async function kvSetRaw(key,val){const x=await kvCommand(['SET',String(key),String(val)]);return x.configured&&x.result==='OK';}
export async function kvSetNxEx(key,val,seconds=180){const x=await kvCommand(['SET',String(key),String(val),'NX','EX',Number(seconds)]);return x.configured&&x.result==='OK';}
export async function kvDel(key){const x=await kvCommand(['DEL',String(key)]);return x.configured?Number(x.result||0):0;}
export async function kvLpush(key,val){const x=await kvCommand(['LPUSH',String(key),String(val)]);return x.configured?Number(x.result||0):0;}
export async function kvLtrim(key,start,stop){const x=await kvCommand(['LTRIM',String(key),Number(start),Number(stop)]);return x.configured&&x.result==='OK';}
export async function kvLrange(key,start=0,stop=99){const x=await kvCommand(['LRANGE',String(key),Number(start),Number(stop)]);return x.configured?(x.result||[]):[];}
export async function kvMget(keys=[]){if(!keys.length)return[];const x=await kvCommand(['MGET',...keys.map(String)]);return x.configured?(x.result||[]):[];}
export async function kvZadd(key,score,member){const x=await kvCommand(['ZADD',String(key),Number(score),String(member)]);return x.configured?Number(x.result||0):0;}
export async function kvZrem(key,member){const x=await kvCommand(['ZREM',String(key),String(member)]);return x.configured?Number(x.result||0):0;}
export async function kvZrangeByScore(key,max,limit=10){const x=await kvCommand(['ZRANGEBYSCORE',String(key),'-inf',Number(max),'LIMIT',0,Number(limit)]);return x.configured?(x.result||[]):[];}

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function fetchJsonWithRetry(url,opt={},retries=2){
  let last;
  for(let i=0;i<=retries;i++){
    try{
      const r=await fetch(url,{...opt,signal:opt.signal||AbortSignal.timeout(30000)}),j=await r.json().catch(()=>({}));
      if(r.ok)return j;
      const msg=j.error?.message||j.error||`HTTP ${r.status}`;
      if(!(r.status===429||r.status>=500)||i===retries){const e=new Error(msg);e.status=r.status;e.code=j.error?.code;e.subcode=j.error?.error_subcode;throw e;}
      last=new Error(msg);
    }catch(e){
      last=e;
      if(e?.status&&e.status<500&&e.status!==429)throw e;
      if(i===retries)throw e;
    }
    await sleep(350*(2**i));
  }
  throw last||new Error('Request failed');
}

export async function graph(path,params={},method='GET',tokenOverride=''){
  const v=env('META_GRAPH_VERSION','v24.0'),token=tokenOverride||params.access_token||env('META_PAGE_TOKEN');
  if(!token)throw new Error('META_PAGE_TOKEN není nastaven.');
  const url=new URL(`https://graph.facebook.com/${v}/${path}`),all={...params,access_token:token};
  if(method==='GET'){
    for(const[k,val]of Object.entries(all))if(val!==undefined&&val!==null)url.searchParams.set(k,String(val));
    return fetchJsonWithRetry(url,{},2);
  }
  const form=new URLSearchParams();for(const[k,val]of Object.entries(all))if(val!==undefined&&val!==null)form.set(k,String(val));
  return fetchJsonWithRetry(url,{method,headers:{'content-type':'application/x-www-form-urlencoded'},body:form},2);
}