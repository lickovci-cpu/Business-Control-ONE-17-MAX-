import {env,kvGet,kvSet,kvSetNxEx,kvDel} from './_lib.js';

const LOCK='business-control:autopilot:lock';
const STATE='business-control:autopilot:state';
const MAX_HISTORY=30;

function authorized(req){
  const secret=env('CRON_SECRET');
  return !!secret && req.headers.authorization===`Bearer ${secret}`;
}

function publicBase(){
  const raw=env('APP_PUBLIC_URL','https://business-control-one.vercel.app');
  return raw.replace(/\/$/,'');
}

function nrsmBase(){
  const raw=env('NRSM_PUBLIC_URL','https://n-m-100.vercel.app');
  return raw.replace(/\/$/,'');
}

async function probe(path,options={}){
  const started=Date.now();
  try{
    const r=await fetch(`${publicBase()}${path}`,{...options,signal:AbortSignal.timeout(12000)});
    const text=await r.text();
    let data=null;try{data=JSON.parse(text)}catch{}
    return {path,ok:r.ok,status:r.status,ms:Date.now()-started,data:data||text.slice(0,500)};
  }catch(e){
    return {path,ok:false,status:0,ms:Date.now()-started,error:e.message};
  }
}

function classify(checks){
  const failed=checks.filter(x=>!x.ok);
  if(!failed.length)return {status:'healthy',priority:'none',nextAction:'continue_monitoring'};
  if(failed.some(x=>x.path==='/api/health'))return {status:'degraded',priority:'P0',nextAction:'inspect_production_health'};
  if(failed.some(x=>x.path==='/api/cron'))return {status:'degraded',priority:'P1',nextAction:'inspect_scheduler'};
  if(failed.some(x=>x.path==='nrsn:/api/bco'))return {status:'degraded',priority:'P1',nextAction:'configure_nrsm_bco_bridge'};
  return {status:'degraded',priority:'P1',nextAction:'inspect_failed_checks'};
}

export default async function handler(req,res){
  if(!authorized(req))return res.status(401).json({error:'unauthorized'});
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  if(!env('KV_REST_API_URL')||!env('KV_REST_API_TOKEN'))return res.status(503).json({error:'KV_NOT_CONFIGURED'});
  const lock=await kvSetNxEx(LOCK,Date.now(),120);
  if(!lock)return res.status(409).json({error:'AUTOPILOT_ALREADY_RUNNING'});
  const started=new Date().toISOString();
  try{
    const secret=env('CRON_SECRET');
    const health=await probe('/api/health',{headers:{Authorization:`Bearer ${secret}`}});
    const cron=health.ok?await probe('/api/cron',{method:'POST',headers:{Authorization:`Bearer ${secret}`}}):{path:'/api/cron',ok:false,status:0,skipped:'health_failed'};
    const nrsm=await probe(`${nrsmBase()}/api/bco`);
    const previous=await kvGet(STATE)||{};
    const checks=[health,cron,{path:'nrsn:/api/bco',ok:nrsm.ok&&nrsm.status===200&&nrsm.data?.configured===true,status:nrsm.status,ms:nrsm.ms,data:nrsm.data||null}];
    const decision=classify(checks);
    const run={id:`night-${Date.now()}`,startedAt:started,finishedAt:new Date().toISOString(),checks,decision};
    const history=Array.isArray(previous.history)?previous.history.slice(-(MAX_HISTORY-1)):[];
    const state={lastRun:run,history:[...history,run],status:decision.status,updatedAt:run.finishedAt};
    await kvSet(STATE,state);
    return res.json({ok:true,mode:'night-shift',run,summary:{status:decision.status,priority:decision.priority,nextAction:decision.nextAction}});
  }catch(e){
    const run={id:`night-${Date.now()}`,startedAt:started,finishedAt:new Date().toISOString(),checks:[],decision:{status:'failed',priority:'P0',nextAction:'inspect_autopilot'},error:e.message};
    await kvSet(STATE,{lastRun:run,status:'failed',updatedAt:run.finishedAt}).catch(()=>{});
    return res.status(500).json({ok:false,run});
  }finally{
    await kvDel(LOCK).catch(()=>{});
  }
}
