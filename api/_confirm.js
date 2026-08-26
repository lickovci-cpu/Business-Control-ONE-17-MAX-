import {createHash,createHmac,timingSafeEqual,randomBytes} from 'node:crypto';
import {env} from './_lib.js';

function secret(){const s=env('APP_CONFIRM_SECRET')||env('APP_PASSWORD');if(!s)throw new Error('APP_CONFIRM_SECRET nebo APP_PASSWORD musí být v produkci nastaven.');return s;}
function canonical(v){
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
  return JSON.stringify(v);
}
function hash(payload){return createHash('sha256').update(canonical(payload)).digest('base64url');}
function sign(data){return createHmac('sha256',secret()).update(data).digest('base64url');}
export function createConfirmation(action,payload,ttlSeconds=600){
  const data={a:String(action),h:hash(payload),exp:Math.floor(Date.now()/1000)+ttlSeconds,n:randomBytes(8).toString('base64url')};
  const enc=Buffer.from(JSON.stringify(data)).toString('base64url');return `${enc}.${sign(enc)}`;
}
export function verifyConfirmation(token,action,payload){
  if(!token||!String(token).includes('.'))throw new Error('CONFIRMATION_REQUIRED');
  const [enc,sig]=String(token).split('.'),expected=sign(enc),a=Buffer.from(sig),b=Buffer.from(expected);
  if(a.length!==b.length||!timingSafeEqual(a,b))throw new Error('CONFIRMATION_INVALID');
  let d;try{d=JSON.parse(Buffer.from(enc,'base64url').toString('utf8'))}catch{throw new Error('CONFIRMATION_INVALID');}
  if(d.exp<Math.floor(Date.now()/1000))throw new Error('CONFIRMATION_EXPIRED');
  if(d.a!==String(action)||d.h!==hash(payload))throw new Error('CONFIRMATION_PAYLOAD_CHANGED');
  return true;
}
