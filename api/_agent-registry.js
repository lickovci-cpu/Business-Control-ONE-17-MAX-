import {env,normalizeSecret} from './_lib.js';

export const PROJECT_ORGS = Object.freeze({
  jihoceske:'09fb6fc9-7ea9-46ac-a84b-bd9952784c0c',
  fve:'09fb6fc9-7ea9-46ac-a84b-bd9952784c0c',
  merch:'d2751286-da99-42c0-b8ac-6a2da8ecdabf',
  mazliprint:'2d971414-9329-4d0b-94df-66cb8413f00c'
});

const STATIC_AGENTS = Object.freeze({
  lead_hunter:{name:'Lead Hunter',task:'crm',autonomy:'supervised',actions:['research','score','create_lead']},
  sales:{name:'Sales Agent',task:'salescoach',autonomy:'approval',actions:['draft_message','prepare_followup']},
  followup:{name:'Follow-up Agent',task:'leadkit',autonomy:'approval',actions:['draft_followup','prepare_message']},
  quote:{name:'Quote Agent',task:'quote',autonomy:'approval',actions:['draft_quote','validate_scope']},
  content:{name:'Content Agent',task:'contentpiece',autonomy:'approval',actions:['draft_post','draft_story','draft_reel']},
  finance:{name:'Finance Agent',task:'crm',autonomy:'supervised',actions:['read_finance','flag_risk']},
  customer:{name:'Customer Agent',task:'leadkit',autonomy:'approval',actions:['draft_review_request','draft_followup']},
  ceo:{name:'CEO Agent',task:'crm',autonomy:'approval',actions:['summarize','prioritize','recommend']},
  developer:{name:'Developer Agent',task:'command',autonomy:'approval',actions:['inspect_repo','draft_code_change','run_tests','prepare_deployment','request_approval']},
  email:{name:'Email Agent',task:'leadkit',autonomy:'approval',actions:['read_email','classify_email','create_lead','create_task','draft_message','request_approval']},
  research:{name:'Research Agent',task:'command',autonomy:'autonomous',actions:['web_research','find_leads','analyze_competitors','create_task','recommend']},
  web:{name:'Web Agent',task:'command',autonomy:'approval',actions:['read_site','audit_site','draft_page','draft_seo','draft_content','request_approval']}
});

function key(){
  return normalizeSecret(env('SUPABASE_SERVICE_ROLE_KEY')||env('SUPABASE_SERVICE_KEY'));
}
function baseUrl(){
  return String(env('SUPABASE_URL','https://vjzzvopwecmwuccdidzq.supabase.co')).replace(/\/$/,'');
}
function projectOrg(project){return PROJECT_ORGS[String(project||'').toLowerCase()]||null;}
async function rest(path,params={}){
  const k=key(); if(!k)return null;
  try{
    const u=new URL(baseUrl()+'/rest/v1/'+path);
    for(const [name,value] of Object.entries(params))u.searchParams.set(name,String(value));
    const r=await fetch(u,{headers:{apikey:k,Authorization:'Bearer '+k},signal:AbortSignal.timeout(5000)});
    if(!r.ok)return null;
    return await r.json().catch(()=>null);
  }catch{return null;}
}
function normalize(row){
  if(!row?.id||!row?.slug)return null;
  const fallback=STATIC_AGENTS[String(row.slug)]||{};
  const cfg=row.config&&typeof row.config==='object'?row.config:{};
  return {
    id:String(row.id),
    slug:String(row.slug),
    name:String(row.name||fallback.name||row.slug),
    description:String(row.description||''),
    active:Boolean(row.active),
    autonomy:String(row.autonomy_level||fallback.autonomy||'approval'),
    allowedActions:Array.isArray(row.allowed_actions)?row.allowed_actions.map(String):Array.isArray(fallback.actions)?fallback.actions:[],
    task:String(cfg.default_task||fallback.task||'command'),
    config:cfg,
    source:'supabase'
  };
}
export function staticAgent(slug){
  const a=STATIC_AGENTS[String(slug||'').toLowerCase()];
  return a?{slug:String(slug).toLowerCase(),...a,id:null,active:true,allowedActions:a.actions,config:{},source:'fallback'}:null;
}
export async function listAgents(project){
  const org=projectOrg(project);
  if(!org)return [];
  const rows=await rest('ai_agents',{organization_id:'eq.'+org,active:'eq.true',select:'id,slug,name,description,active,autonomy_level,allowed_actions,config',order:'slug.asc'});
  if(Array.isArray(rows)&&rows.length)return rows.map(normalize).filter(Boolean);
  if(env('NODE_ENV','production')!=='production'&&env('AGENT_REGISTRY_FALLBACK','false')==='true'){
    return Object.keys(STATIC_AGENTS).map(staticAgent).filter(Boolean);
  }
  return [];
}
export async function getAgent(project,slug){
  const wanted=String(slug||'').toLowerCase();
  const rows=await listAgents(project);
  return rows.find(a=>a.slug===wanted)||null;
}
export function agentFallbackEnabled(){
  return env('NODE_ENV','production')!=='production'&&env('AGENT_REGISTRY_FALLBACK','false')==='true';
}
export async function recordAgentEvent({project,agentId,eventType,severity='info',entityType=null,entityId=null,payload={}}){
  const org=projectOrg(project),k=key();
  if(!org||!agentId||!k)return false;
  try{
    const r=await fetch(baseUrl()+'/rest/v1/ai_agent_events',{
      method:'POST',
      headers:{apikey:k,Authorization:'Bearer '+k,'content-type':'application/json',Prefer:'return=minimal'},
      body:JSON.stringify({
        organization_id:org,
        agent_id:agentId,
        event_type:String(eventType||'run'),
        severity:String(severity||'info'),
        entity_type:entityType?String(entityType):null,
        entity_id:entityId||null,
        payload:payload&&typeof payload==='object'?payload:{}
      }),
      signal:AbortSignal.timeout(5000)
    });
    return r.ok;
  }catch{return false;}
}
export function projectOrganizationId(project){return projectOrg(project);}
