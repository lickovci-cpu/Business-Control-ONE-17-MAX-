import {auth,noauth,projectKey,env,normalizeSecret,sendError,body} from './_lib.js';
import {getAgent,listAgents,recordAgentEvent} from './_agent-registry.js';

function currentOrigin(req){
  const proto=String(req.headers?.['x-forwarded-proto']||'https');
  const host=String(req.headers?.host||env('APP_PUBLIC_URL','https://business-control-one.vercel.app').replace(/^https?:\/\//,'')).split(',')[0].trim();
  return `${proto}://${host}`;
}

async function runAi(req,payload){
  const url=`${currentOrigin(req)}/api/ai`;
  const headers={'content-type':'application/json'};
  const password=normalizeSecret(env('APP_PASSWORD'));
  if(password)headers['x-app-key']=password;
  const r=await fetch(url,{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(70000)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(j.error||`AI HTTP ${r.status}`);e.status=r.status;throw e;}
  return j;
}

function publicAgent(a){
  return {
    id:a.id,
    slug:a.slug,
    name:a.name,
    description:a.description||'',
    active:a.active!==false,
    autonomy:a.autonomy,
    actions:Array.isArray(a.allowedActions)?a.allowedActions:[],
    task:a.task,
    config:a.config||{},
    source:a.source||'unknown'
  };
}

export default async function handler(req,res){
  if(!auth(req))return noauth(res);
  try{
    const project=projectKey(req.method==='GET'?req.query?.project||'jihoceske':req.body?.project||'jihoceske');
    if(req.method==='GET'){
      const agents=await listAgents(project);
      return res.json({
        ok:true,
        project,
        agents:agents.map(publicAgent),
        approvalPolicy:{
          mutatingActionsRequireHumanApproval:true,
          publicationRequiresHumanApproval:true,
          pricingRequiresHumanApproval:true
        }
      });
    }
    if(req.method!=='POST')return res.status(405).json({error:'METHOD'});
    const b=await body(req,700000);
    const id=String(b.agent||'').trim().toLowerCase();
    const agent=await getAgent(project,id);
    if(!agent||agent.active===false)return res.status(400).json({error:'UNKNOWN_AGENT'});
    const requestedTask=String(b.task||'').trim();
    const task=requestedTask&&requestedTask===agent.task?requestedTask:agent.task;
    if(requestedTask&&requestedTask!==task){
      await recordAgentEvent({
        project,
        agentId:agent.id,
        eventType:'task_override_rejected',
        severity:'warn',
        payload:{requestedTask,defaultTask:task}
      });
    }
    const ai=await runAi(req,{
      agent:id,
      agentId:agent.id||undefined,
      task,
      project,
      context:b.context||{},
      prompt:String(b.prompt||''),
      images:Array.isArray(b.images)?b.images.slice(0,10):[],
      provider:String(b.provider||'auto')
    });
    await recordAgentEvent({
      project,
      agentId:agent.id,
      eventType:'run_completed',
      severity:'info',
      payload:{
        task,
        provider:ai?.provider||null,
        fallbackUsed:Boolean(ai?.fallbackUsed),
        structuredValid:Boolean(ai?.structuredValid)
      }
    });
    return res.json({
      ok:true,
      agent:publicAgent(agent),
      project,
      requiresApproval:agent.autonomy!=='autonomous',
      ai
    });
  }catch(e){
    return sendError(res,e);
  }
}
