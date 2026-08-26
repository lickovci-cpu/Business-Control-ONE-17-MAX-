import {auth,noauth,body,kvGet,kvSet,projectKey,sendError} from './_lib.js';
function safeKey(v){const k=String(v||'business-control');if(!/^business-control(?::[a-zA-Z0-9._-]+)*$/.test(k))throw new Error('INVALID_STORE_KEY');return k;}
export default async function handler(req,res){
  if(!auth(req))return noauth(res);
  try{
    const project=projectKey(req.query.project||'jihoceske');
    if(req.method==='GET'){const key=safeKey(req.query.key||`business-control:${project}`);return res.json({data:await kvGet(key),project});}
    if(req.method==='POST'){const b=await body(req,600000),p=projectKey(b.project||project),key=safeKey(b.key||`business-control:${p}`),ok=await kvSet(key,b.data??{});return res.json({ok,mode:ok?'kv':'supabase-or-local',project:p});}
    return res.status(405).json({error:'METHOD'});
  }catch(e){return sendError(res,e);}
}
