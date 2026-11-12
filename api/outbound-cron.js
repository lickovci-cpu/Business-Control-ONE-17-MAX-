import {env,supabaseBaseUrl,supabaseRequestCredentials,kvSetNxEx,kvDel} from './_lib.js';
import {sendOutlookEmail} from './_outlook.js';
import {campaignPolicyAllowsAutonomousDispatch} from './_control.js';

const isoNow=()=>new Date().toISOString();
function dbCreds(){const c=supabaseRequestCredentials();if(!c?.apikey||c.mode!=='service')throw new Error('SUPABASE_SERVER_CREDENTIAL_NOT_CONFIGURED');return c;}
async function db(path,options={}){
  const c=dbCreds(),r=await fetch(supabaseBaseUrl()+'/rest/v1/'+path,{...options,headers:{apikey:c.apikey,authorization:c.authorization,'content-type':'application/json',...(options.headers||{})}});
  const text=await r.text();if(!r.ok){const e=new Error('OUTBOUND_DB_'+r.status);e.status=r.status;throw e;}return text?JSON.parse(text):null;
}
async function patchMessage(id,status,patch){
  return db('outbound_messages?id=eq.'+encodeURIComponent(id)+'&status=eq.'+encodeURIComponent(status),{method:'PATCH',headers:{prefer:'return=representation'},body:JSON.stringify({...patch,updated_at:isoNow()})});
}
async function count(path){
  const c=dbCreds(),r=await fetch(supabaseBaseUrl()+'/rest/v1/'+path,{headers:{apikey:c.apikey,authorization:c.authorization,prefer:'count=exact',range:'0-0'}});
  if(!r.ok)throw new Error('OUTBOUND_COUNT_FAILED_'+r.status);
  const h=r.headers.get('content-range')||'*/0';return Number(h.split('/')[1]||0);
}
async function suppressed(org,recipient){
  const rows=await db('outreach_suppressions?select=id&organization_id=eq.'+org+'&channel=eq.email&recipient_normalized=eq.'+encodeURIComponent(String(recipient).trim().toLowerCase())+'&limit=1');
  return Array.isArray(rows)&&rows.length>0;
}
async function recordAudit(m,event,details={}){
  await db('outreach_audit_events',{method:'POST',headers:{prefer:'return=minimal'},body:JSON.stringify({organization_id:m.organization_id,outbound_message_id:m.id,campaign_policy_id:m.campaign_policy_id,event_type:event,actor:'outbound-cron',details})});
}
async function hold(m,status,reason){
  await patchMessage(m.id,'queued',{status,last_error:reason});
  await recordAudit(m,'MESSAGE_'+status.toUpperCase(),{reason});
}
async function recoverStaleProcessing(){
  const cutoff=new Date(Date.now()-10*60*1000).toISOString();
  const rows=await db('outbound_messages?select=id,organization_id,campaign_policy_id,status,processing_started_at&status=eq.processing&processing_started_at=lt.'+encodeURIComponent(cutoff)+'&limit=100');
  for(const row of rows||[]){
    await db('outbound_messages?id=eq.'+row.id+'&status=eq.processing',{method:'PATCH',headers:{prefer:'return=minimal'},body:JSON.stringify({status:'needs_review',last_error:'STALE_PROCESSING_REQUIRES_MANUAL_DELIVERY_CHECK',processing_started_at:null,updated_at:isoNow()})});
    await recordAudit(row,'MESSAGE_NEEDS_REVIEW',{reason:'STALE_PROCESSING_REQUIRES_MANUAL_DELIVERY_CHECK'});
  }
  return (rows||[]).length;
}
export default async function handler(req,res){
  if(req.method!=='POST'&&req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  const secret=env('CRON_SECRET');if(!secret||req.headers.authorization!==('Bearer '+secret))return res.status(401).json({error:'AUTH_REQUIRED'});
  if(env('OUTBOUND_AUTONOMY_ENABLED','false')!=='true')return res.status(200).json({ok:true,disabled:true,reason:'OUTBOUND_AUTONOMY_DISABLED',processed:0});
  try{
    const recovered=await recoverStaleProcessing();
    const due=await db('outbound_messages?select=*,outreach_campaign_policies(*)&status=eq.queued&or=(scheduled_at.is.null,scheduled_at.lte.'+encodeURIComponent(isoNow())+')&order=scheduled_at.asc.nullsfirst&limit=10');
    const results=[];
    for(const m of due||[]){
      const messageLockKey='bco:outbound-message-lock:'+m.id;
      const messageLock=await kvSetNxEx(messageLockKey,'1',180);if(!messageLock)continue;
      let policyLockKey=null,policyLock=false;
      try{
        const p=m.outreach_campaign_policies,decision=campaignPolicyAllowsAutonomousDispatch(p,m,new Date());
        if(!decision.allowed||await suppressed(m.organization_id,m.recipient_normalized)){
          await hold(m,'suppressed',decision.reason||'RECIPIENT_SUPPRESSED');results.push({id:m.id,status:'suppressed'});continue;
        }
        policyLockKey='bco:outbound-policy-lock:'+p.id;
        policyLock=await kvSetNxEx(policyLockKey,'1',180);
        if(!policyLock)continue;
        const start=new Date();start.setHours(0,0,0,0);
        const base='outbound_messages?select=id&campaign_policy_id=eq.'+p.id+'&status=in.(accepted,delivered)';
        const dayCount=await count(base+'&accepted_at=gte.'+encodeURIComponent(start.toISOString()));
        const totalCount=await count(base);
        const contactCount=await count(base+'&contact_id=eq.'+m.contact_id);
        const recipientCount=await count(base+'&recipient_normalized=eq.'+encodeURIComponent(m.recipient_normalized));
        if(dayCount>=p.max_messages_per_day||totalCount>=p.max_total_messages||contactCount>=p.max_messages_per_contact||recipientCount>=p.max_messages_per_contact){
          await hold(m,'needs_review','CAMPAIGN_RATE_LIMIT_REACHED');results.push({id:m.id,status:'needs_review'});continue;
        }
        const claimed=await patchMessage(m.id,'queued',{status:'processing',processing_started_at:isoNow(),attempts:Number(m.attempts||0)+1});
        if(!Array.isArray(claimed)||claimed.length!==1)continue;
        await recordAudit(m,'MESSAGE_PROCESSING');
        try{
          const sent=await sendOutlookEmail({organizationId:m.organization_id,to:m.recipient,subject:m.subject,text:m.body});
          await db('outbound_messages?id=eq.'+m.id,{method:'PATCH',headers:{prefer:'return=minimal'},body:JSON.stringify({status:'accepted',provider:sent.provider,accepted_at:isoNow(),processing_started_at:null,last_error:null,updated_at:isoNow()})});
          await recordAudit(m,'MESSAGE_ACCEPTED',{provider:sent.provider});results.push({id:m.id,status:'accepted'});
        }catch(e){
          const uncertain=!e.status||e.status>=500||e.status===429,status=uncertain?'needs_review':'failed';
          await db('outbound_messages?id=eq.'+m.id,{method:'PATCH',headers:{prefer:'return=minimal'},body:JSON.stringify({status,last_error:String(e.message||'SEND_FAILED').slice(0,300),processing_started_at:null,updated_at:isoNow()})});
          await recordAudit(m,'MESSAGE_'+status.toUpperCase(),{error:String(e.message||'SEND_FAILED').slice(0,200)});
          results.push({id:m.id,status});
        }
      }finally{
        if(policyLock&&policyLockKey)await kvDel(policyLockKey).catch(()=>{});
        await kvDel(messageLockKey).catch(()=>{});
      }
    }
    return res.status(200).json({ok:true,recovered,processed:results.length,results});
  }catch(e){return res.status(500).json({error:e.message||'OUTBOUND_CRON_FAILED'});}
}
