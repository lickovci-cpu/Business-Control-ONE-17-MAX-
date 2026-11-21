const EVERY_FIVE_MINUTES=Object.freeze([
  '/api/cron',
  '/api/automation-tick',
  '/api/outbound-cron'
]);
const MERCH_ROUTE='/api/merch-cron';
const OUTBOX_ROUTE='/api/integrations/outbox-consumer';

function asDate(value){const date=new Date(value);if(!Number.isFinite(date.getTime()))throw new Error('INVALID_SCHEDULED_TIME');return date;}
function trustedOrigin(value){
  const url=new URL(String(value||''));
  if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||!url.hostname.includes('.')||url.hostname==='localhost'||url.hostname.endsWith('.local'))throw new Error('INVALID_CRON_ORIGIN');
  return url.origin;
}

export async function dispatchCronJobs(scheduledTime,env,fetcher=fetch){
  const secret=String(env?.CRON_SECRET||'');
  if(!secret)return {ok:false,blocked:'CRON_SECRET_NOT_CONFIGURED',results:[]};
  let origin;
  try{origin=trustedOrigin(env?.BCO_CRON_ORIGIN);}catch{return {ok:false,blocked:'BCO_CRON_ORIGIN_INVALID',results:[]};}
  const date=asDate(scheduledTime);
  const jobs=[...EVERY_FIVE_MINUTES];
  if(env.BCO_OUTBOX_CONSUMER_ENABLED==='true')jobs.push(OUTBOX_ROUTE);
  // Vercel's original 0 */6 * * * schedule is UTC; use scheduledTime, not wall-clock time.
  if(date.getUTCMinutes()===0&&date.getUTCHours()%6===0)jobs.push(MERCH_ROUTE);
  const results=[];
  for(const path of jobs){
    try{
      const response=await fetcher(origin+path,{
        method:'POST',
        headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json','Cache-Control':'no-store'},
        body:JSON.stringify({source:'bco-cloudflare-cron-dispatcher',scheduledAt:date.toISOString()})
      });
      const result={path,status:response.status,ok:response.ok};
      results.push(result);
    }catch(error){results.push({path,ok:false,error:String(error?.message||'FETCH_FAILED').slice(0,180)});}
  }
  return {ok:results.every(x=>x.ok),scheduledAt:date.toISOString(),results};
}

export default {
  async scheduled(event,env,ctx){
    const work=dispatchCronJobs(event.scheduledTime,env).then(result=>{
      if(!result.ok)console.error('BCO_CRON_DISPATCH_PARTIAL',JSON.stringify(result));
      return result;
    });
    ctx?.waitUntil?.(work);
    return work;
  }
};
