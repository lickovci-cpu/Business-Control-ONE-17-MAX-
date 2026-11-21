import {verifyOrganizationIdentity} from '../api/_cloud-identity-core.js';

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

function json(status,data){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff'}});}
function encodePath(path){return path.split('/').map(encodeURIComponent).join('/');}
function absoluteSignedUrl(value,base){
  const raw=String(value||'');
  if(/^https?:\/\//i.test(raw)){try{return new URL(raw).origin===new URL(base).origin?raw:'';}catch{return '';}}
  if(raw.startsWith('/storage/v1/'))return base+raw;
  if(raw.startsWith('/'))return base+'/storage/v1'+raw;
  return base+'/storage/v1/'+raw;
}
function ascii(bytes,start,end){return new TextDecoder().decode(bytes.slice(start,end));}
function validFileSignature(mime,body){
  const starts=(...bytes)=>body.length>=bytes.length&&bytes.every((value,index)=>body[index]===value);
  if(mime==='image/jpeg')return starts(0xff,0xd8,0xff);
  if(mime==='image/png')return starts(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a);
  if(mime==='image/webp')return body.length>=12&&ascii(body,0,4)==='RIFF'&&ascii(body,8,12)==='WEBP';
  if(mime==='image/gif')return ascii(body,0,6)==='GIF87a'||ascii(body,0,6)==='GIF89a';
  if(mime==='application/pdf')return ascii(body,0,5)==='%PDF-';
  if(mime==='video/webm')return starts(0x1a,0x45,0xdf,0xa3);
  if(mime==='video/mp4'||mime==='video/quicktime')return body.length>=12&&ascii(body,4,8)==='ftyp';
  return false;
}
async function readBody(request){
  const declared=Number(request.headers.get('content-length')||0);
  if(Number.isFinite(declared)&&declared>MAX_UPLOAD_BYTES)return {error:{status:413,error:'FILE_TOO_LARGE',maxBytes:MAX_UPLOAD_BYTES}};
  if(!request.body)return {error:{status:400,error:'EMPTY_FILE'}};
  const reader=request.body.getReader(),chunks=[];let size=0;
  try{
    while(true){
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>MAX_UPLOAD_BYTES){await reader.cancel();return {error:{status:413,error:'FILE_TOO_LARGE',maxBytes:MAX_UPLOAD_BYTES}};}
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  if(!size)return {error:{status:400,error:'EMPTY_FILE'}};
  const body=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}
  return {body,size};
}
async function storageError(response){
  const body=await response.json().catch(()=>({}));
  return {status:response.status>=400&&response.status<500?response.status:502,error:'STORAGE_REQUEST_FAILED',detail:String(body.message||body.error||body.msg||'Storage rejected the request').slice(0,160)};
}

export async function handlePrivateStorage(request,env,fetcher=fetch){
  const url=new URL(request.url);
  if(url.pathname!=='/api/cloud-storage')return json(404,{error:'NOT_FOUND'});
  if(request.method!=='GET'&&request.method!=='POST')return json(405,{error:'METHOD_NOT_ALLOWED'});
  if(env?.BCO_PRIVATE_STORAGE_ENABLED!=='true')return json(503,{error:'PRIVATE_STORAGE_DISABLED'});
  const identity=await verifyOrganizationIdentity({
    authorization:request.headers.get('authorization'),
    organizationId:url.searchParams.get('organization_id'),
    supabaseUrl:env.SUPABASE_URL,
    publishableKey:env.SUPABASE_PUBLISHABLE_KEY,
    fetcher
  });
  if(!identity.ok)return json(identity.status,{error:identity.error});
  const bucket=String(url.searchParams.get('bucket')||'bco-media');
  if(bucket!=='bco-media'&&bucket!=='job-media')return json(400,{error:'BUCKET_NOT_ALLOWED'});

  if(request.method==='POST'){
    const mime=String(request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
    const type=TYPES[mime];
    if(!type||!type.buckets.includes(bucket))return json(415,{error:'UNSUPPORTED_MEDIA_TYPE'});
    const jobId=String(url.searchParams.get('job_id')||'');
    if(bucket==='job-media'&&!new RegExp(`^${UUID}$`,'i').test(jobId))return json(400,{error:'JOB_ID_REQUIRED'});
    if(bucket==='bco-media'&&jobId)return json(400,{error:'JOB_ID_NOT_ALLOWED'});
    const uploadedBody=await readBody(request);
    if(uploadedBody.error)return json(uploadedBody.error.status,uploadedBody.error);
    if(!validFileSignature(mime,uploadedBody.body))return json(415,{error:'FILE_SIGNATURE_MISMATCH'});
    const objectId=crypto.randomUUID();
    const path=bucket==='job-media'?`${identity.organizationId}/${jobId}/${objectId}.${type.extension}`:`${identity.organizationId}/${objectId}.${type.extension}`;
    const endpoint=identity.base+'/storage/v1/object/'+bucket+'/'+encodePath(path);
    const uploaded=await fetcher(endpoint,{method:'POST',headers:{apikey:identity.key,Authorization:'Bearer '+identity.token,'Content-Type':mime,'x-upsert':'false'},body:uploadedBody.body,signal:AbortSignal.timeout(30000)});
    if(!uploaded.ok){const failure=await storageError(uploaded);return json(failure.status,{error:failure.error,detail:failure.detail});}
    await uploaded.body?.cancel().catch(()=>{});
    return json(201,{ok:true,bucket,path,size:uploadedBody.size,mime,organizationId:identity.organizationId});
  }

  const path=String(url.searchParams.get('path')||'');
  if(path.includes('..')||path.includes('\\')||path.startsWith('/')||path.includes('\0'))return json(400,{error:'INVALID_OBJECT_PATH'});
  const match=bucket==='job-media'?path.match(JOB_PATH_RE):path.match(ORG_PATH_RE);
  if(!match||match[1].toLowerCase()!==identity.organizationId.toLowerCase())return json(403,{error:'OBJECT_PATH_OUTSIDE_ORGANIZATION'});
  const endpoint=identity.base+'/storage/v1/object/sign/'+bucket+'/'+encodePath(path);
  const signed=await fetcher(endpoint,{method:'POST',headers:{apikey:identity.key,Authorization:'Bearer '+identity.token,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:SIGNED_URL_SECONDS,download:true}),signal:AbortSignal.timeout(15000)});
  if(!signed.ok){const failure=await storageError(signed);return json(failure.status,{error:failure.error,detail:failure.detail});}
  const result=await signed.json().catch(()=>({}));
  const signedUrl=absoluteSignedUrl(result.signedURL||result.signedUrl,identity.base);
  if(!signedUrl.startsWith(identity.base+'/storage/v1/object/sign/'))return json(502,{error:'SIGNED_URL_RESPONSE_INVALID'});
  return json(200,{ok:true,bucket,path,signedUrl,expiresIn:SIGNED_URL_SECONDS});
}

export default {async fetch(request,env){return handlePrivateStorage(request,env);}};
