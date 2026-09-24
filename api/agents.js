import {auth,noauth,projectKey,env,normalizeSecret,sendError,body} from './_lib.js';

const AGENTS = {"lead_hunter":{"name":"Lead Hunter","task":"crm","autonomy":"supervised","actions":["research","score","create_lead"]},"sales":{"name":"Sales Agent","task":"salescoach","autonomy":"approval","actions":["draft_message","prepare_followup"]},"followup":{"name":"Follow-up Agent","task":"leadkit","autonomy":"approval","actions":["draft_followup","prepare_message"]},"quote":{"name":"Quote Agent","task":"quote","autonomy":"approval","actions":["draft_quote","validate_scope"]},"content":{"name":"Content Agent","task":"contentpiece","autonomy":"approval","actions":["draft_post","draft_story","draft_reel"]},"finance":{"name":"Finance Agent","task":"crm","autonomy":"supervised","actions":["read_finance","flag_risk"]},"customer":{"name":"Customer Agent","task":"leadkit","autonomy":"approval","actions":["draft_review_request","draft_followup"]},"ceo":{"name":"CEO Agent","task":"crm","autonomy":"approval","actions":["summarize","prioritize","recommend"]}};

function currentOrigin(req){
  const proto=String(req.headers?.['x-forwarded-proto']||'https');
  const host=String(req.headers?.host||env('APP_PUBLIC_URL','https://business-control-one.vercel.app').replace(/^https?:\/\//,'')).split(',')[0].trim();
  return `${proto}://${host}`;
}

async function runAi(req, payload){
  const url=`${currentOrigin(req)}/api/ai`;
  const headers={'content-type':'application/json'};
  const password=normalizeSecret(env('APP_PASSWORD'));
  if(password)headers['x-app-key']=password;
  const r=await fetch(url,{method:'POST',headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(70000)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok){const e=new Error(j.error||`AI HTTP ${r.status}`);e.status=r.status;throw e;}
  return j;
}

export default async function handler(req,res){
  if(!auth(req))return noauth(res);
  try{
    if(req.method==='GET'){
      const project=projectKey(req.query?.project||'jihoceske');
      return res.json({ok:true,project,agents:Object.entries(AGENTS).map(([id,a])=>({id,...a})),approvalPolicy:{mutatingActionsRequireHumanApproval:true,publicationRequiresHumanApproval:true,pricingRequiresHumanApproval:true}});
    }
    if(req.method!=='POST')return res.status(405).json({error:'METHOD'});
    const b=await body(req,700000),id=String(b.agent||'').trim().toLowerCase();
    if(!AGENTS[id])return res.status(400).json({error:'UNKNOWN_AGENT'});
    const project=projectKey(b.project||'jihoceske'),a=AGENTS[id];
    const ai=await runAi(req,{agent:id,task:String(b.task||a.task),project,context:b.context||{},prompt:String(b.prompt||''),images:Array.isArray(b.images)?b.images.slice(0,10):[],provider:String(b.provider||'auto')});
    return res.json({ok:true,agent:{id,...a},project,requiresApproval:a.autonomy!=='autonomous',ai});
  }catch(e){return sendError(res,e);}
}
