import {randomUUID} from 'node:crypto';
import {env,kvGet,kvSet,kvSetNxEx,kvDel,kvLrange,kvMget,kvZrangeByScore,kvZadd,kvZrem} from './_lib.js';
import {sendCommunication} from './_comms.js';
const INDEX='business-control:outbox:index',DUE='business-control:outbox:due',ITEM=id=>`business-control:outbox:item:${id}`,LOCK=id=>`business-control:outbox:lock:${id}`;
const backoffMs=a=>[5,15,60][Math.min(Math.max(a-1,0),2)]*60*1000;
async function save(item){await kvSet(ITEM(item.id),item);}
async function recoverStale(){
  const ids=await kvLrange(INDEX,0,499);if(!ids.length)return[];const vals=await kvMget(ids.map(ITEM)),now=Date.now(),recovered=[];
  for(let i=0;i<vals.length;i++){let x=vals[i];if(!x)continue;try{x=typeof x==='string'?JSON.parse(x):x}catch{continue}if(x.status==='processing'&&x.processingStartedAt&&now-new Date(x.processingStartedAt).getTime()>10*60*1000){x.status='needs_review';x.deliveryUncertain=true;x.lastError='Předchozí běh skončil během odesílání; kvůli riziku duplicity je nutná ruční kontrola.';x.recoveredAt=new Date().toISOString();await save(x);recovered.push(x.id)}}return recovered;
}
export default async function handler(req,res){
  const sec=env('CRON_SECRET');if(!sec)return res.status(503).json({error:'CRON_SECRET_NOT_SET'});if(req.headers.authorization!==`Bearer ${sec}`)return res.status(401).json({error:'unauthorized'});
  try{
    const recovered=await recoverStale(),now=Date.now(),due=await kvZrangeByScore(DUE,now,10),results=[];
    for(const id of due){
      const lock=await kvSetNxEx(LOCK(id),randomUUID(),180);if(!lock)continue;
      try{
        const item=await kvGet(ITEM(id));if(!item||!['queued','retry_wait'].includes(item.status)){await kvZrem(DUE,id);continue;}
        if(item.nextAttemptAt&&new Date(item.nextAttemptAt).getTime()>now)continue;
        item.status='processing';item.processingStartedAt=new Date().toISOString();await save(item);await kvZrem(DUE,id);
        try{
          const result=await sendCommunication(item);item.status='sent';item.sentAt=new Date().toISOString();item.resultId=result.id||null;item.deliveryUncertain=false;item.processingStartedAt=null;await save(item);results.push({id:item.id,ok:true,channel:item.channel});
        }catch(e){
          item.attempts=(item.attempts||0)+1;item.lastError=e.message;item.lastAttemptAt=new Date().toISOString();item.processingStartedAt=null;
          if(e.uncertain){item.status='needs_review';item.deliveryUncertain=true;}
          else if(e.retryable&&item.attempts<3){item.status='retry_wait';item.nextAttemptAt=new Date(Date.now()+backoffMs(item.attempts)).toISOString();await kvZadd(DUE,new Date(item.nextAttemptAt).getTime(),item.id);}
          else item.status='failed';
          await save(item);results.push({id:item.id,ok:false,status:item.status,error:e.message});
        }
      }finally{await kvDel(LOCK(id)).catch(()=>{});}
    }
    const s=await kvGet('business-control')||{};s.lastCronAt=new Date().toISOString();s.lastCronResults=results;s.lastCronRecovered=recovered;await kvSet('business-control',s);res.json({ok:true,at:s.lastCronAt,recovered,processed:results});
  }catch(e){res.status(500).json({error:e.message});}
}
