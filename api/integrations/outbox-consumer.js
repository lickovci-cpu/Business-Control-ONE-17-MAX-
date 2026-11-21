import {env,supabaseBaseUrl,supabaseServiceKey,safeEqual} from '../_lib.js';

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number.isFinite(n)?Math.trunc(n):min));
function json(res,status,data){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(data);}
function sinkUrl(){
  const raw=env('BCO_OUTBOX_SINK_URL');
  const url=new URL(raw||'');
  if(url.protocol!=='https:'||url.username||url.password||!url.hostname.includes('.')||url.hostname==='localhost'||url.hostname.endsWith('.local'))throw new Error('OUTBOX_SINK_URL_INVALID');
  return url.toString();
}
async function rpc(name,payload,base,key){
  const response=await fetch(base+'/rest/v1/rpc/'+name,{
    method:'POST',
    headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(15000)
  });
  const raw=await response.text();
  let data=null;try{data=raw?JSON.parse(raw):null;}catch{}
  if(!response.ok)throw new Error('OUTBOX_RPC_'+name.toUpperCase()+'_'+response.status);
  return data;
}
function eventIsValid(row){
  return UUID_RE.test(String(row?.id||''))&&UUID_RE.test(String(row?.organization_id||''))&&UUID_RE.test(String(row?.lock_token||''))&&typeof row?.dedupe_key==='string'&&row.dedupe_key.length>0&&row.dedupe_key.length<=512&&typeof row?.event_type==='string'&&row.event_type.length>0&&row.event_type.length<=80&&Number.isInteger(row?.attempts)&&row.attempts>=1&&row.payload!==null&&typeof row.payload==='object'&&!Array.isArray(row.payload);
}

export default async function handler(req,res){
  if(req.method!=='POST')return json(res,405,{error:'METHOD_NOT_ALLOWED'});
  const cronSecret=env('CRON_SECRET');
  if(!cronSecret)return json(res,503,{error:'CRON_SECRET_NOT_CONFIGURED'});
  if(!safeEqual(String(req.headers?.authorization||''),'Bearer '+cronSecret))return json(res,401,{error:'UNAUTHORIZED'});
  if(env('BCO_INTEGRATION_OUTBOX_ENABLED','false')!=='true')return json(res,200,{ok:true,disabled:true,claimed:0,processed:0,retried:0,dead:0});
  let base,key,sink, sinkSecret;
  try{
    base=supabaseBaseUrl();key=supabaseServiceKey();sink=sinkUrl();sinkSecret=env('BCO_OUTBOX_SINK_SECRET');
    if(!base||!key||!sinkSecret)throw new Error('OUTBOX_SERVER_CONFIGURATION_INCOMPLETE');
  }catch(error){return json(res,503,{error:error.message||'OUTBOX_SERVER_CONFIGURATION_INCOMPLETE'});}
  const batch=clamp(Number(env('BCO_OUTBOX_BATCH_SIZE','20')),1,50);
  try{
    const claimed=await rpc('claim_integration_outbox',{p_limit:batch},base,key);
    if(!Array.isArray(claimed))return json(res,502,{error:'OUTBOX_CLAIM_RESPONSE_INVALID'});
    const result={ok:true,claimed:claimed.length,processed:0,retried:0,dead:0,stale:0,invalid:0};
    for(const row of claimed){
      if(!eventIsValid(row)){
        result.invalid++;
        if(UUID_RE.test(String(row?.id||''))&&UUID_RE.test(String(row?.lock_token||''))){
          try{const state=await rpc('fail_integration_outbox',{p_id:row.id,p_lock_token:row.lock_token,p_error:'INVALID_OUTBOX_EVENT_SHAPE',p_retryable:false},base,key);if(state==='dead')result.dead++;else if(state==='retry')result.retried++;else result.stale++;}catch{result.stale++;}
        }
        continue;
      }
      const idempotencyKey=row.organization_id+':'+row.dedupe_key;
      try{
        const response=await fetch(sink,{
          method:'POST',
          headers:{Authorization:'Bearer '+sinkSecret,'Content-Type':'application/json','Idempotency-Key':idempotencyKey,'X-BCO-Event-Type':row.event_type},
          body:JSON.stringify({eventId:row.id,organizationId:row.organization_id,eventType:row.event_type,payload:row.payload,attempt:row.attempts}),
          signal:AbortSignal.timeout(20000)
        });
        await response.body?.cancel().catch(()=>{});
        if(!response.ok){const failure=new Error('OUTBOX_SINK_HTTP_'+response.status);failure.status=response.status;throw failure;}
        const completed=await rpc('complete_integration_outbox',{p_id:row.id,p_lock_token:row.lock_token},base,key);
        if(completed===true)result.processed++;else result.stale++;
      }catch(error){
        try{
          const status=Number(error?.status),retryable=!(status>=400&&status<500&&![408,409,425,429].includes(status));
          const state=await rpc('fail_integration_outbox',{p_id:row.id,p_lock_token:row.lock_token,p_error:String(error?.message||'OUTBOX_DELIVERY_FAILED').slice(0,1800),p_retryable:retryable},base,key);
          if(state==='retry')result.retried++;else if(state==='dead')result.dead++;else result.stale++;
        }catch{result.stale++;}
      }
    }
    result.ok=result.invalid===0&&result.stale===0&&result.retried===0&&result.dead===0;
    return json(res,200,result);
  }catch(error){
    return json(res,502,{error:String(error?.message||'OUTBOX_CONSUMER_FAILED').slice(0,180)});
  }
}
