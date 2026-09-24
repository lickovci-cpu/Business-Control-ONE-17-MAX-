import {env,normalizeSecret} from './_lib.js';

const PROJECT_TO_ORG_SLUG = Object.freeze({
  jihoceske:'fve',
  fve:'fve',
  mazliprint:'mazliprint',
  merch:'ne-e-m'
});

const orgCache = new Map();

function safeText(value,max=500){
  return String(value??'').replace(/[\x00-\x1F\x7F]/g,' ').slice(0,max);
}

async function resolveOrganizationId(project){
  const slug=PROJECT_TO_ORG_SLUG[String(project||'').toLowerCase()];
  if(!slug)return null;
  if(orgCache.has(slug))return orgCache.get(slug);
  const key=normalizeSecret(env('SUPABASE_SERVICE_ROLE_KEY')||env('SUPABASE_SERVICE_KEY'));
  if(!key)return null;
  const base=String(env('SUPABASE_URL','https://vjzzvopwecmwuccdidzq.supabase.co')).replace(/\/$/,'');
  try{
    const u=new URL(base+'/rest/v1/organizations');
    u.searchParams.set('select','id');
    u.searchParams.set('slug','eq.'+slug);
    u.searchParams.set('limit','1');
    const r=await fetch(u,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(5000)});
    if(!r.ok)return null;
    const rows=await r.json().catch(()=>[]);
    const id=rows?.[0]?.id?String(rows[0].id):null;
    if(id)orgCache.set(slug,id);
    return id;
  }catch{return null;}
}

async function insertRun(row){
  const key=normalizeSecret(env('SUPABASE_SERVICE_ROLE_KEY')||env('SUPABASE_SERVICE_KEY'));
  if(!key)return false;
  const base=String(env('SUPABASE_URL','https://vjzzvopwecmwuccdidzq.supabase.co')).replace(/\\/$/,'');
  const r=await fetch(base+'/rest/v1/ai_runs',{
    method:'POST',
    headers:{
      apikey:key,
      Authorization:'Bearer '+key,
      'content-type':'application/json',
      Prefer:'return=minimal'
    },
    body:JSON.stringify(row),
    signal:AbortSignal.timeout(5000)
  });
  return r.ok;
}

export async function recordAiRun({
  project,
 agent='ai',
  task,
  status='completed',
  provider=null,
  model=null,
  requestedProvider='auto',
  fallbackUsed=false,
  attemptedProviders=[],
  imageCount=0,
  outputChars=0,
  structuredExpected=false,
  structuredValid=false,
  latencyMs=0,
  error=null
}){
  try{
    const organization_id=await resolveOrganizationId(project);
    if(!organization_id)return null;
    const input={
      project:String(project||''),
      requestedProvider:safeText(requestedProvider,40),
      imageCount:Number(imageCount)||0
    };
    const output={
      provider:provider?String(provider):null,
      model:model?String(model):null,
      fallbackUsed:Boolean(fallbackUsed),
      attemptedProviders:Array.isArray(attemptedProviders)?attemptedProviders.map(x=>safeText(x,40)).slice(0,8):[],
      outputChars:Number(outputChars)||0,
      structuredExpected:Boolean(structuredExpected),
      structuredValid:Boolean(structuredValid),
      latencyMs:Math.max(0,Number(latencyMs)||0)
    };
    return await insertRun({
      organization_id,
      user_id:null,
      agent:safeText(agent,80)||'ai',
      task:safeText(task,80)||'unknown',
      status:safeText(status,40)||'completed',
      provider:provider?safeText(provider,80):null,
      model:model?safeText(model,160):null,
      input,
      output,
      error:error?safeText(error,500):null,
      started_at:new Date(Date.now()-Math.max(0,Number(latencyMs)||0)).toISOString(),
      completed_at:new Date().toISOString()
    });
  }catch{return null;}
}
