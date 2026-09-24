import {env,safeEqual,normalizeSecret,createSessionToken,setSessionCookie,clearSessionCookie,verifySessionToken,body,sendError} from './_lib.js';
const attempts=new Map();
const MAX_ATTEMPTS=8,LOCK_MS=3*60*1000;
function clientKey(req){
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
  const ua=String(req.headers['user-agent']||'unknown').slice(0,120);
  return `${ip}|${ua}`;
}
function cookie(req){const m=String(req.headers.cookie||'').match(/(?:^|;\s*)bc_session=([^;]+)/);return m?decodeURIComponent(m[1]):'';}
function state(key){const x=attempts.get(key);if(!x)return null;if(Date.now()>=x.until){attempts.delete(key);return null;}return x;}
function fail(key){const x=state(key)||{count:0,until:Date.now()+LOCK_MS};x.count++;attempts.set(key,x);return x;}
export default async function handler(req,res){
  try{
    res.setHeader('Cache-Control','no-store');
    if(req.method==='GET')return res.json({authenticated:verifySessionToken(cookie(req)),configured:!!env('APP_PASSWORD')});
    if(req.method==='DELETE'){clearSessionCookie(res);return res.json({ok:true});}
    if(req.method!=='POST')return res.status(405).json({error:'METHOD'});
    const key=clientKey(req),x=state(key);
    if(x?.count>=MAX_ATTEMPTS){const retry=Math.max(1,Math.ceil((x.until-Date.now())/1000));res.setHeader('Retry-After',String(retry));return res.status(429).json({error:'TOO_MANY_ATTEMPTS',retryAfterSeconds:retry});}
    const b=await body(req,4096),expected=normalizeSecret(env('APP_PASSWORD'));if(!expected)return res.status(503).json({error:'APP_PASSWORD_NOT_CONFIGURED'});
    if(!safeEqual(String(b.password||''),expected)){const next=fail(key);const remaining=Math.max(0,MAX_ATTEMPTS-next.count);return res.status(401).json({error:'INVALID_PASSWORD',remainingAttempts:remaining});}
    attempts.delete(key);setSessionCookie(res,createSessionToken());return res.json({ok:true});
  }catch(e){return sendError(res,e);}
}
