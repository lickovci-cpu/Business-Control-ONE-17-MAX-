import {auth,noauth,env,normalizeSecret,kvGet,kvSet,fetchJsonWithRetry} from './_lib.js';

const ORG='d2751286-da99-42c0-b8ac-6a2da8ecdabf';
const SB_URL=env('SUPABASE_URL','https://vjzzvopwecmwuccdidzq.supabase.co');
const PLAN_KEY='business-control:merch:revenue-plan-v2';

function authorized(req){
  const secret=env('CRON_SECRET');
  return auth(req) || (!!secret && req.headers.authorization==='Bearer '+secret);
}
function clean(v,max=1200){return String(v??'').trim().slice(0,max)}
async function query(path,params={}){
  const key=normalizeSecret(env('SUPABASE_SERVICE_ROLE_KEY')||env('SUPABASE_SERVICE_KEY'));
  if(!key)throw Object.assign(new Error('SUPABASE_SERVICE_ROLE_KEY_NOT_CONFIGURED'),{status:503});
  const u=new URL(SB_URL+'/rest/v1/'+path);
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v)));
  return fetchJsonWithRetry(u,{headers:{apikey:key,Authorization:'Bearer '+key}},1);
}
function counts(rows=[]){return rows.reduce((a,x)=>{const k=String(x.status||'unknown');a[k]=(a[k]||0)+1;return a;},{});}
function sum(rows=[],field){return rows.reduce((n,x)=>n+(Number(x[field])||0),0);}
function isLikelyFveText(v){
  const t=String(v??'').toLowerCase();
  return /\bfve\b|fotovolta|montážn(?:í|e) dvoj|montáže fve|solar|solars|fotovoltaika/.test(t);
}
async function snapshot(){
  const [leads,prospects,drafts,orders]=await Promise.all([
    query('leads',{organization_id:'eq.'+ORG,select:'id,status,estimated_value,next_action_at,updated_at',order:'updated_at.desc',limit:250}),
    query('merch_prospects',{organization_id:'eq.'+ORG,select:'id,company_name,domain,email,status,fit_score,next_action_at,created_at',order:'fit_score.desc,created_at.asc',limit:250}),
    query('merch_outreach_drafts',{organization_id:'eq.'+ORG,select:'id,prospect_id,status,subject,created_at,sent_at',order:'created_at.desc',limit:250}),
    query('merch_orders',{organization_id:'eq.'+ORG,select:'id,status,total,created_at',order:'created_at.desc',limit:250})
  ]);
  const now=Date.now();
  const dueLead=(leads||[]).filter(x=>x.next_action_at&&new Date(x.next_action_at).getTime()<=now&&!['paid','closed','lost'].includes(x.status)).length;
  const dueProspect=(prospects||[]).filter(x=>x.next_action_at&&new Date(x.next_action_at).getTime()<=now&&!['converted','rejected','suppressed'].includes(x.status)).length;
  const last7=(orders||[]).filter(x=>now-new Date(x.created_at).getTime()<=7*24*60*60*1000);
  const fveProspectIds=new Set((drafts||[]).filter(d=>isLikelyFveText(d.subject)).map(d=>d.prospect_id).filter(Boolean));
  const activeMerchProspects=(prospects||[]).filter(x=>!fveProspectIds.has(x.id)&&!isLikelyFveText(x.company_name+' '+x.domain));
  return {
    at:new Date().toISOString(),
    leads:{count:(leads||[]).length,status:counts(leads),pipelineValue:sum(leads,'estimated_value'),due:dueLead},
    prospects:{
      count:(prospects||[]).length,
      relevantCount:activeMerchProspects.length,
      excludedLikelyFve:(prospects||[]).length-activeMerchProspects.length,
      status:counts(prospects),
      due:dueProspect,
      priority:activeMerchProspects
        .filter(x=>!['converted','rejected','suppressed'].includes(String(x.status||'')))
        .slice(0,10)
        .map(x=>({companyName:clean(x.company_name,180),domain:clean(x.domain,240),email:clean(x.email,240),fitScore:Number(x.fit_score)||0,status:clean(x.status,80)||'unknown',nextActionAt:x.next_action_at||null}))
    },
    outreach:{count:(drafts||[]).length,status:counts(drafts)},
    orders:{count:(orders||[]).length,status:counts(orders),gross:sum(orders,'total'),recent7dCount:last7.length,recent7dGross:sum(last7,'total')}
  };
}
function fallback(s){
  const today=[];
  if(!s.prospects.relevantCount)today.push('Naplnit pipeline 10 relevantními B2B prospecty; žádný další redesign.');
  if(s.prospects.relevantCount && !s.outreach.status?.draft)today.push('Připravit personalizované 1:1 nabídky pro nejlepší prospecty.');
  if(s.outreach.status?.draft)today.push('Projít drafty a schválit pouze relevantní zprávy.');
  if(s.prospects.due)today.push('Vyřídit '+s.prospects.due+' splatných prospect follow-upů.');
  if(s.leads.due)today.push('Vyřídit '+s.leads.due+' CRM follow-upů.');
  if(!s.orders.count)today.push('Cíl je první placená B2B zakázka; spotřebitelský shop je sekundární.');
  return {version:1,generatedAt:new Date().toISOString(),mode:'rule-based',snapshot:s,priority:'cash_within_7_days',today:today.slice(0,5),thisWeek:['B2B artist/crew/event merch','nabídka do 24 h od poptávky','výroba až po schválení zakázky'],kill:['další redesign bez prokazatelného dopadu na konverzi','placená reklama před ověřením nabídky a marže'],needsUser:['produkční secrets a sociální účty musí být připojené uživatelem','outbound marketingové zprávy zůstávají ve schválení'],selfCritique:'Hlavní riziko je nedostatek skutečných obchodních příležitostí, ne nedostatek funkcí.'};
}
async function plan(s){
  const key=env('GEMINI_API_KEY');
  if(!key)return fallback(s);
  const prompt='Jsi revenue operator NŘŠM Merch Studio. Zpracuj pouze tato skutečná data a rozhodni, co má nejvyšší potenciál přinést hotovost do 7 dnů. Ignoruj vanity metrics. Upřednostni B2B custom merch, pokud data neukazují lepší cestu. Nenavrhuj další design, analytiku ani placenou reklamu bez přímé vazby na tržbu. Vrať pouze JSON s poli priority,today,thisWeek,kill,needsUser,selfCritique,experiments. Data: '+JSON.stringify(s);
  try{
    const j=await fetchJsonWithRetry('https://generativelanguage.googleapis.com/v1beta/models/'+env('GEMINI_MODEL','gemini-3.5-flash-lite')+':generateContent',{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{maxOutputTokens:900,temperature:0.2}})},1);
    const raw=j.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('')||'';
    const m=raw.match(/\{[\s\S]*\}/);
    return {version:1,generatedAt:new Date().toISOString(),mode:'gemini',snapshot:s,...JSON.parse(m?m[0]:raw)};
  }catch{return fallback(s)}
}

export default async function handler(req,res){
  if(!authorized(req))return noauth(res);
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{
    if(req.method==='GET')return res.json({ok:true,plan:await kvGet(PLAN_KEY)});
    const previous=await kvGet(PLAN_KEY);
    const sameDay=previous?.generatedAt&&new Date(previous.generatedAt).toISOString().slice(0,10)===new Date().toISOString().slice(0,10);
    if(sameDay)return res.json({ok:true,cached:true,plan:previous});
    const s=await snapshot();
    const next=await plan(s);
    await kvSet(PLAN_KEY,next);
    return res.json({ok:true,cached:false,plan:next});
  }catch(e){return res.status(Number(e?.status)||500).json({error:e?.message||'MERCH_REVENUE_FAILED'});}
}
