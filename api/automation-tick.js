import {randomUUID} from 'node:crypto';
import {env,normalizeSecret,fetchJsonWithRetry,kvSetNxEx,kvDel,supabaseBaseUrl,supabaseServiceKey} from './_lib.js';
import {getAgent,projectOrganizationId,recordAgentEvent} from './_agent-registry.js';

const LOCK='business-control:automation-runtime:lock';
const MAX_AUTOMATIONS_PER_TICK=3;
const MAX_AI_AUTOMATIONS_PER_TICK=1;

const ORG_TO_PROJECT=Object.freeze({
  fve:'jihoceske',
  'ne-e-m':'merch',
  mazliprint:'mazliprint'
});

const clean=(v,max=1000)=>String(v??'').trim().slice(0,max);
const now=()=>new Date();

export function intervalMs(config={}){
  if(config.schedule==='every_6_hours')return 6*60*60*1000;
  if(config.interval_hours!=null){
    const n=Number(config.interval_hours);
    if(Number.isFinite(n)&&n>0)return n*60*60*1000;
  }
  if(config.interval_minutes!=null){
    const n=Number(config.interval_minutes);
    if(Number.isFinite(n)&&n>0)return n*60*1000;
  }
  return null;
}

export function isDue(row,at=new Date()){
  if(!row?.active)return false;
  const ms=intervalMs(row.trigger_config||{});
  if(!ms)return false;
  if(!row.last_run_at)return true;
  const last=new Date(row.last_run_at);
  return Number.isFinite(last.getTime()) && at.getTime()-last.getTime()>=ms;
}

export function projectForOrgSlug(slug){
  return ORG_TO_PROJECT[String(slug||'').toLowerCase()]||null;
}

function supabaseKey(){
  return supabaseServiceKey();
}

function supabaseBase(){
  return supabaseBaseUrl();
}

async function sb(path,params={},method='GET',payload){
  const key=supabaseKey();
  if(!key)throw Object.assign(new Error('SUPABASE_SERVICE_ROLE_KEY_NOT_CONFIGURED'),{status:503});
  const u=new URL(supabaseBase()+'/rest/v1/'+path);
  for(const [k,v] of Object.entries(params))u.searchParams.set(k,String(v));
  const headers={apikey:key,Authorization:'Bearer '+key,'content-type':'application/json',Prefer:'return=representation'};
  const opt={method,headers};
  if(payload!==undefined)opt.body=JSON.stringify(payload);
  return fetchJsonWithRetry(u,opt,1);
}

async function listDueAutomations(at){
  const rows=await sb('automations',{
    active:'eq.true',
    trigger_type:'eq.scheduled',
    select:'id,organization_id,name,active,trigger_type,trigger_config,action_config,last_run_at,created_at',
    order:'last_run_at.asc.nullsfirst,created_at.asc',
    limit:50
  });
  return (Array.isArray(rows)?rows:[]).filter(x=>isDue(x,at)).slice(0,MAX_AUTOMATIONS_PER_TICK);
}

async function orgSlugById(id){
  const rows=await sb('organizations',{id:'eq.'+encodeURIComponent(id),select:'id,slug',limit:1});
  return Array.isArray(rows)&&rows[0]?String(rows[0].slug):null;
}

async function summarizeProject(project){
  const org=projectOrganizationId(project);
  if(!org)return {project,leads:0,jobs:0,quotes:0,financeEntries:0,openTasks:0};
  const [leads,jobs,quotes,finance,openTasks]=await Promise.all([
    sb('leads',{organization_id:'eq.'+org,select:'id,status,estimated_value,next_action_at',limit:200}),
    sb('jobs',{organization_id:'eq.'+org,select:'id,status,scheduled_for',limit:200}).catch(()=>[]),
    sb('quotes',{organization_id:'eq.'+org,select:'id,status,total',limit:200}).catch(()=>[]),
    sb('financial_entries',{organization_id:'eq.'+org,select:'id,amount,date,type,status',limit:200}).catch(()=>[]),
    sb('tasks',{organization_id:'eq.'+org,status:'in.(open,in_progress,blocked)',select:'id,title,priority,status,due_at',limit:100}).catch(()=>[])
  ]);
  return {
    project,
    leads:Array.isArray(leads)?leads.map(x=>({status:x.status,value:x.estimated_value||null,nextActionAt:x.next_action_at||null})).slice(0,100):[],
    jobs:Array.isArray(jobs)?jobs.map(x=>({status:x.status,scheduledFor:x.scheduled_for||null})).slice(0,100):[],
    quotes:Array.isArray(quotes)?quotes.map(x=>({status:x.status,total:x.total||null})).slice(0,100):[],
    financeEntries:Array.isArray(finance)?finance.length:0,
    financeTotal:Array.isArray(finance)?finance.reduce((s,x)=>s+Number(x.amount||0),0):0,
    openTasks:Array.isArray(openTasks)?openTasks.map(x=>({title:x.title,priority:x.priority,status:x.status,dueAt:x.due_at||null})).slice(0,100):[]
  };
}

function agentEndpoint(req){
  const proto=String(req?.headers?.['x-forwarded-proto']||'https');
  const host=String(req?.headers?.host||env('APP_PUBLIC_URL','https://business-control-one.vercel.app').replace(/^https?:\/\//,'')).split(',')[0].trim();
  return proto+'://'+host+'/api/agents';
}

async function runAgent(req,automation,project,context){
  const actionConfig=automation.action_config&&typeof automation.action_config==='object'?automation.action_config:{};
  const agentSlug=clean(actionConfig.agent||'ceo',80).toLowerCase();
  const agent=await getAgent(project,agentSlug);
  if(!agent)return {ok:false,error:'AGENT_NOT_CONFIGURED',agent:agentSlug};
  if(agent.active===false)return {ok:false,error:'AGENT_INACTIVE',agent:agentSlug};
  const endpoint=agentEndpoint(req);
  const password=normalizeSecret(env('APP_PASSWORD'));
  const body={
    agent:agentSlug,
    project,
    prompt:clean(
      actionConfig.prompt||
      'Proveď autonomní plánovací tick. Pracuj pouze s doloženými daty. Navrhni další kroky jen tam, kde dávají smysl. Nevymýšlej kontakty, ceny, reference ani hotové výsledky. Externí odesílání, publikování a placené akce musí zůstat ve schvalování.',
      5000
    ),
    context
  };
  const headers={'content-type':'application/json'};
  if(password)headers['x-app-key']=password;
  const result=await fetchJsonWithRetry(endpoint,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(65000)},0);
  return {ok:true,result,agent};
}

function taskPriority(v){
  const x=String(v||'').toUpperCase();
  return x==='A'||x==='B'||x==='C'?x:'B';
}

function extractActions(ai){
  const parsed=ai?.parsed;
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return [];
  const candidates=Array.isArray(parsed.nextActions)?parsed.nextActions:Array.isArray(parsed.tasks)?parsed.tasks:[];
  return candidates.map(x=>typeof x==='string'?{title:x,priority:'B'}:(x&&typeof x==='object'?{title:x.title||x.action||x.text||'',priority:x.priority||'B',notes:x.notes||x.note||''}:null))
    .filter(x=>x&&clean(x.title,400))
    .slice(0,7);
}

async function createTasks(project,orgId,automation,actions){
  const created=[];
  for(const action of actions){
    const title=clean(action.title,400);
    const existing=await sb('tasks',{
      organization_id:'eq.'+orgId,
      entity_type:'eq.automation',
      entity_id:'eq.'+automation.id,
      title:'eq.'+title,
      status:'in.(open,in_progress,blocked)',
      select:'id',
      limit:1
    }).catch(()=>[]);
    if(Array.isArray(existing)&&existing.length)continue;
    const row={
      organization_id:orgId,
      title,
      status:'open',
      priority:taskPriority(action.priority),
      due_at:null,
      assigned_to:null,
      entity_type:'automation',
      entity_id:automation.id,
      notes:clean(action.notes||'',1000)||'Automatický návrh z automace.'
    };
    const saved=await sb('tasks',{},'POST',row);
    const item=Array.isArray(saved)?saved[0]:saved;
    if(item?.id)created.push(item);
  }
  return created;
}

async function writeRun(automation,orgId,status,input,output,error=null){
  return sb('automation_runs',{},'POST',{
    organization_id:orgId,
    automation_id:automation.id,
    status,
    input:input||{},
    output:output||{},
    error:error?clean(error,1500):null,
    started_at:input?.startedAt||new Date().toISOString(),
    completed_at:new Date().toISOString()
  });
}

async function markRun(automation){
  return sb('automations',{id:'eq.'+automation.id},'PATCH',{last_run_at:new Date().toISOString(),updated_at:new Date().toISOString()});
}

export async function executeAutomationTick(req){
  const lock=await kvSetNxEx(LOCK,randomUUID(),110);
  if(!lock)throw Object.assign(new Error('AUTOMATION_TICK_ALREADY_RUNNING'),{status:409});
  const at=now(),processed=[],errors=[];
  try{
    const due=await listDueAutomations(at);
    let aiCount=0;
    for(const automation of due){
      const startedAt=new Date().toISOString();
      const orgId=String(automation.organization_id);
      try{
        const orgSlug=await orgSlugById(orgId);
        const project=projectForOrgSlug(orgSlug);
        if(!project)throw new Error('UNMAPPED_ORGANIZATION');
        const actionConfig=automation.action_config&&typeof automation.action_config==='object'?automation.action_config:{};
        const agentSlug=String(actionConfig.agent||'').toLowerCase();
        const configuredAgent=agentSlug?await getAgent(project,agentSlug):null;
        const context={project,organizationSlug:orgSlug,automation:{id:automation.id,name:automation.name,trigger:automation.trigger_config,action:actionConfig},state:await summarizeProject(project),startedAt};
        let result={ok:true,mode:'task_only'};
        let createdTasks=[];
        if(configuredAgent?.active!==false&&configuredAgent?.autonomy==='autonomous'&&aiCount>=MAX_AI_AUTOMATIONS_PER_TICK){
          errors.push({automation:automation.name,error:'AI_TICK_BUDGET_DEFERRED'});
          continue;
        }
        if(configuredAgent?.active!==false&&configuredAgent?.autonomy==='autonomous'){
          const agentResult=await runAgent(req,automation,project,context);
          if(!agentResult.ok)throw new Error(agentResult.error||'AGENT_FAILED');
          aiCount++;
          const ai=agentResult.result?.ai||{};
          const actions=extractActions(ai);
          createdTasks=await createTasks(project,orgId,automation,actions);
          await recordAgentEvent({project,agentId:agentResult.agent.id,eventType:'autonomous_tick',severity:'info',payload:{automationId:automation.id,createdTasks:createdTasks.length}});
          result={ok:true,mode:'agent',agent:agentSlug,provider:ai.provider||null,createdTasks:createdTasks.length,structuredValid:Boolean(ai.structuredValid)};
        }else{
          const title=clean(actionConfig.prompt||automation.name,400);
          createdTasks=await createTasks(project,orgId,automation,[{title,priority:'B',notes:'Automatická úloha čekající na zpracování specializovaným agentem nebo ruční kontrolu.'}]);
          result={ok:true,mode:'task_only',agent:agentSlug||null,createdTasks:createdTasks.length};
        }
        await writeRun(automation,orgId,'completed',{project,automationId:automation.id,startedAt},result);
        await markRun(automation);
        processed.push({automationId:automation.id,name:automation.name,project,result});
      }catch(e){
        const error=clean(e?.message||'AUTOMATION_FAILED',1500);
        await writeRun(automation,orgId,'failed',{automationId:automation.id,startedAt},null,error).catch(()=>{});
        errors.push({automation:automation.name,error});
      }
    }
    return {ok:true,at:at.toISOString(),processed,errors};
  }finally{
    await kvDel(LOCK).catch(()=>{});
  }
}

export default async function handler(req,res){
  const secret=env('CRON_SECRET');
  if(!secret)return res.status(503).json({error:'CRON_SECRET_NOT_SET'});
  if(req.headers.authorization!==`Bearer ${secret}`)return res.status(401).json({error:'UNAUTHORIZED'});
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{
    const result=await executeAutomationTick(req);
    return res.json(result);
  }catch(e){
    return res.status(Number(e?.status)||500).json({error:e?.message||'AUTOMATION_TICK_FAILED'});
  }
}
