import {randomUUID} from 'node:crypto';
import {cloudIdentityForOrganization} from './_cloud-auth.js';

export const config={api:{bodyParser:false}};
const MAX_UPLOAD_BYTES=4*1024*1024;
const SIGNED_URL_SECONDS=120;
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const ORG_PATH_RE=new RegExp(`^(${UUID})/(${UUID})\\.(jpg|jpeg|png|webp|gif|mp4|webm|mov|pdf)$`,'i');
const JOB_PATH_RE=new RegExp(`^(${UUID})/(${UUID})/(${UUID})\\.(jpg|png|webp|pdf)$`,'i');
const TYPES=Object.freeze({
  'image/jpeg':{extension:'jpg',buckets:['bco-media','job-media']},
  'image/png':{extension:'png',buckets:['bco-media','job-media']},
  'image/webp':{extension:'webp',buckets:['bco-media','job-media']},
  'image/gif':{extension:'gif',buckets:['bco-media']},
  'video/mp4':{extension:'mp4',buckets:['bco-media']},
  'video/webm':{extension:'webm',buckets:['bco-media']},
  'video/quicktime':{extension:'mov',buckets:['bco-media']},
  'application/pdf':{extension:'pdf',buckets:['bco-media','job-media']}
});

function reply(res,status,data){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Pragma','no-cache');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(status).json(data);
}
function requestUrl(req){return new URL(String(req.url||'/'),`https://${String(req.headers?.host||'bco.invalid').split(',')[0].trim()}`);}
function storagePath(bucket,path){return path.split('/').map(encodeURIComponent).join('/');}
function validFileSignature(mime,body){
  const starts=(...bytes)=>body.length>=bytes.length&&bytes.every((value,index)=>body[index]===value);
  if(mime==='image/jpeg')return starts(0xff,0xd8,0xff);
  if(mime==='image/png')return starts(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a);
  if(mime==='image/webp')return body.length>=12&&body.toString('ascii',0,4)==='RIFF'&&body.toString('ascii',8,12)==='WEBP';
  if(mime==='image/gif')return body.toString('ascii',0,6)==='GIF87a'||body.toString('ascii',0,6)==='GIF89a';
  if(mime==='application/pdf')return body.toString('ascii',0,5)==='%PDF-';
  if(mime==='video/webm')return starts(0x1a,0x45,0xdf,0xa3);
  if(mime==='video/mp4'||mime==='video/quicktime')return body.length>=12&&body.toString('ascii',4,8)==='ftyp';
  return false;
}
function absoluteSignedUrl(value,base){
  const raw=String(value||'');
  if(/^https?:\/\//i.test(raw)){try{return new URL(raw).origin===new URL(base).origin?raw:'';}catch{return '';}}
  if(raw.startsWith('/storage/v1/'))return base+raw;
  if(raw.startsWith('/'))return base+'/storage/v1'+raw;
  return base+'/storage/v1/'+raw;
}
async function readLimitedBody(req){
  const declared=Number(req.headers?.['content-length']||0);
  if(Number.isFinite(declared)&&declared>MAX_UPLOAD_BYTES){const e=new Error('FILE_TOO_LARGE');e.status=413;throw e;}
  const chunks=[];let size=0;
  for await(const chunk of req){
    const part=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
    size+=part.length;
    if(size>MAX_UPLOAD_BYTES){const e=new Error('FILE_TOO_LARGE');e.status=413;throw e;}
    chunks.push(part);
  }
  if(!size){const e=new Error('EMPTY_FILE');e.status=400;throw e;}
  return {body:Buffer.concat(chunks,size),size};
}
async function storageError(response){
  const body=await response.json().catch(()=>({}));
  const message=String(body.message||body.error||body.msg||'').slice(0,160);
  const denied=String(body.statusCode||'')==='403'||/row-level security|rls denied|unauthorized|not authorized/i.test(message);
  const status=denied?403:(response.status>=400&&response.status<500?response.status:502);
  return {status,error:'STORAGE_REQUEST_FAILED',detail:message||'Storage rejected the request'};
}

export default async function handler(req,res){
  if(req.method!=='POST'&&req.method!=='GET')return reply(res,405,{error:'METHOD_NOT_ALLOWED'});
  if(process.env.BCO_PRIVATE_STORAGE_ENABLED!=='true')return reply(res,503,{error:'PRIVATE_STORAGE_DISABLED'});
  try{
    const url=requestUrl(req);
    const organizationId=String(url.searchParams.get('organization_id')||'');
    const identity=await cloudIdentityForOrganization(req,organizationId);
    if(!identity?.ok)return reply(res,identity?.status||401,{error:identity?.error||'SUPABASE_AUTH_REQUIRED'});
    const bucket=String(url.searchParams.get('bucket')||'bco-media');
    if(bucket!=='bco-media'&&bucket!=='job-media')return reply(res,400,{error:'BUCKET_NOT_ALLOWED'});

    if(req.method==='POST'){
      const mime=String(req.headers?.['content-type']||'').split(';')[0].trim().toLowerCase();
      const type=TYPES[mime];
      if(!type||!type.buckets.includes(bucket))return reply(res,415,{error:'UNSUPPORTED_MEDIA_TYPE'});
      const jobId=String(url.searchParams.get('job_id')||'');
      if(bucket==='job-media'&&!new RegExp(`^${UUID}$`,'i').test(jobId))return reply(res,400,{error:'JOB_ID_REQUIRED'});
      if(bucket==='bco-media'&&jobId)return reply(res,400,{error:'JOB_ID_NOT_ALLOWED'});
      const {body,size}=await readLimitedBody(req);
      if(!validFileSignature(mime,body))return reply(res,415,{error:'FILE_SIGNATURE_MISMATCH'});
      const objectId=randomUUID();
      const path=bucket==='job-media'
        ?`${identity.organizationId}/${jobId}/${objectId}.${type.extension}`
        :`${identity.organizationId}/${objectId}.${type.extension}`;
      const endpoint=identity.base+'/storage/v1/object/'+bucket+'/'+storagePath(bucket,path);
      const uploaded=await fetch(endpoint,{
        method:'POST',
        headers:{apikey:identity.key,Authorization:'Bearer '+identity.token,'Content-Type':mime,'x-upsert':'false'},
        body,
        signal:AbortSignal.timeout(30000)
      });
      if(!uploaded.ok){const failure=await storageError(uploaded);return reply(res,failure.status,{error:failure.error,detail:failure.detail});}
      return reply(res,201,{ok:true,bucket,path,size,mime,organizationId:identity.organizationId,userId:identity.userId});
    }

    const path=String(url.searchParams.get('path')||'');
    if(path.includes('..')||path.includes('\\')||path.startsWith('/')||path.includes('\0'))return reply(res,400,{error:'INVALID_OBJECT_PATH'});
    const pathMatch=bucket==='job-media'?path.match(JOB_PATH_RE):path.match(ORG_PATH_RE);
    if(!pathMatch||pathMatch[1].toLowerCase()!==identity.organizationId.toLowerCase())return reply(res,403,{error:'OBJECT_PATH_OUTSIDE_ORGANIZATION'});
    const endpoint=identity.base+'/storage/v1/object/sign/'+bucket+'/'+storagePath(bucket,path);
    const signed=await fetch(endpoint,{
      method:'POST',
      headers:{apikey:identity.key,Authorization:'Bearer '+identity.token,'Content-Type':'application/json'},
      body:JSON.stringify({expiresIn:SIGNED_URL_SECONDS,download:true}),
      signal:AbortSignal.timeout(15000)
    });
    if(!signed.ok){const failure=await storageError(signed);return reply(res,failure.status,{error:failure.error,detail:failure.detail});}
    const result=await signed.json().catch(()=>({}));
    const signedUrl=absoluteSignedUrl(result.signedURL||result.signedUrl,identity.base);
    if(!signedUrl.startsWith(identity.base+'/storage/v1/object/sign/'))return reply(res,502,{error:'SIGNED_URL_RESPONSE_INVALID'});
    return reply(res,200,{ok:true,bucket,path,signedUrl,expiresIn:SIGNED_URL_SECONDS});
  }catch(error){
    const status=Number(error?.status)||500;
    return reply(res,status,status===413?{error:'FILE_TOO_LARGE',maxBytes:MAX_UPLOAD_BYTES}:{error:error?.message==='EMPTY_FILE'?'EMPTY_FILE':'PRIVATE_STORAGE_REQUEST_FAILED'});
  }
}
