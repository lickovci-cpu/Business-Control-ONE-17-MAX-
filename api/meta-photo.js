import {createHash} from 'node:crypto';
import {auth,noauth,env,projectKey,sendError,kvGet,kvSet} from './_lib.js';
import {createConfirmation,verifyConfirmation,getConfirmationData} from './_confirm.js';
import {getTask} from './_control.js';
import {resolveMeta} from './_meta-auth.js';
export const config={api:{bodyParser:false}};
const MAX_FILE=3*1024*1024;
function decodeManifest(v){try{return JSON.parse(Buffer.from(String(v||''),'base64url').toString('utf8'))}catch{throw new Error('PHOTO_MANIFEST_INVALID')}}
async function readBuffer(req,max){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>max){const e=new Error('PHOTO_TOO_LARGE');e.status=413;throw e;}chunks.push(c)}return Buffer.concat(chunks)}
async function uploadToMeta(buf,mime,index,c){
  if(!c.configured)throw new Error('META_NOT_CONFIGURED_FOR_PROJECT');
  const v=env('META_GRAPH_VERSION','v24.0'),fd=new FormData();fd.set('access_token',c.token);fd.set('published','false');fd.set('source',new Blob([buf],{type:mime}),`photo-${index+1}.${mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg'}`);
  const r=await fetch(`https://graph.facebook.com/${v}/${c.pageId}/photos`,{method:'POST',body:fd,signal:AbortSignal.timeout(45000)}),j=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(j.error?.message||`Meta photo upload error (${r.status})`);e.status=r.status;e.code=j.error?.code;e.subcode=j.error?.error_subcode;throw e;}if(!j.id)throw new Error('META_PHOTO_ID_MISSING');return String(j.id);
}
export default async function handler(req,res){
  if(!auth(req))return noauth(res);if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{
    const project=projectKey(req.headers['x-project']||'jihoceske'),manifest=decodeManifest(req.headers['x-photo-manifest']),token=String(req.headers['x-confirm-token']||'');
    if(!Array.isArray(manifest)||!manifest.length||manifest.length>10)throw new Error('PHOTO_MANIFEST_INVALID');
    const decoded=getConfirmationData(token);if(!decoded.taskId||!String(decoded.a||'').startsWith('control:'))throw new Error('CONTROL_APPROVAL_REQUIRED');
    const task=await getTask(decoded.taskId);if(!task)throw new Error('TASK_NOT_FOUND');
    if(task.project!==project)throw Object.assign(new Error('PROJECT_MISMATCH'),{status:409});
    if(!['meta:publish-photos','meta:schedule-photos'].includes(task.action)||task.status!=='WAITING_APPROVAL')throw new Error('PHOTO_UPLOAD_NOT_APPROVED');
    verifyConfirmation(token,`control:${task.action}`,{taskId:task.id,project:task.project,action:task.action,payloadHash:task.payloadHash});
    const expected=Array.isArray(task.payload?.photos)?task.payload.photos.map(x=>({mime:x.mime,size:x.size,sha256:x.sha256})):[];
    if(JSON.stringify(expected)!==JSON.stringify(manifest))throw new Error('PHOTO_MANIFEST_MISMATCH');
    const index=Number(req.headers['x-photo-index']);if(!Number.isInteger(index)||index<0||index>=manifest.length)throw new Error('PHOTO_INDEX_INVALID');
    const item=manifest[index]||{},mime=String(req.headers['content-type']||'').split(';')[0].toLowerCase();if(!/^image\/(jpeg|png|webp)$/.test(mime)||mime!==item.mime)throw new Error('PHOTO_MIME_INVALID');
    if(!Number.isFinite(Number(item.size))||item.size<=0||item.size>MAX_FILE)throw new Error('PHOTO_SIZE_INVALID');
    const buf=await readBuffer(req,MAX_FILE);if(buf.length!==Number(item.size))throw new Error('PHOTO_SIZE_CHANGED');const sha256=createHash('sha256').update(buf).digest('hex');if(sha256!==String(item.sha256))throw new Error('PHOTO_HASH_CHANGED');
    const idKey=`business-control:meta-photo:${task.id}:${index}:${sha256}`,existing=await kvGet(idKey);if(existing?.id)return res.json(existing);
    const id=await uploadToMeta(buf,mime,index,await resolveMeta(project)),proofPayload={project,index,id,sha256},proof=createConfirmation('meta:photo-proof',proofPayload,900),result={id,proof};
    if(!await kvSet(idKey,result)){const e=new Error('CONTROL_STORAGE_NOT_CONFIGURED');e.status=503;throw e;}return res.json(result);
  }catch(e){return sendError(res,e);}
}
