import {noauth,body,kvGet,kvSet,projectKey,sendError} from './_lib.js';
import {cloudAdmin} from './_cloud-auth.js';
function safeKey(value,project){
  const key=String(value||`business-control:${project}`);
  const prefix=`business-control:${project}`;
  if(key!==prefix&&!key.startsWith(prefix+':'))throw new Error('INVALID_STORE_KEY');
  return key;
}
export default async function handler(req,res){
  const project=projectKey(req.query?.project||req.body?.project||'jihoceske');
  if(!(await cloudAdmin(req,project)))return noauth(res);
  try{
    if(req.method==='GET'){
      const key=safeKey(req.query?.key,project);
      return res.json({data:await kvGet(key),project});
    }
    if(req.method==='POST'){
      const b=await body(req,600000),bodyProject=projectKey(b.project||project);
      if(bodyProject!==project)return res.status(403).json({error:'PROJECT_SCOPE_MISMATCH'});
      const key=safeKey(b.key,project),ok=await kvSet(key,b.data??{});
      return res.json({ok,mode:ok?'kv':'supabase-or-local',project});
    }
    return res.status(405).json({error:'METHOD'});
  }catch(error){return sendError(res,error);}
}
