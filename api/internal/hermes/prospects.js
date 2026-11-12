import {env,supabaseBaseUrl,supabaseRequestCredentials,safeEqual,body} from '../../_lib.js';
const NRSM_ORG='d2751286-da99-42c0-b8ac-6a2da8ecdabf';
const clean=(v,max=500)=>String(v||'').trim().slice(0,max);
async function rest(path,credentials,options={}){
  const r=await fetch(supabaseBaseUrl()+'/rest/v1/'+path,{...options,headers:{apikey:credentials.apikey,authorization:credentials.authorization,'content-type':'application/json',...(options.headers||{})}});
  const text=await r.text();if(!r.ok){const e=new Error('SUPABASE_WRITE_FAILED_'+r.status);e.status=r.status;throw e;}return text?JSON.parse(text):null;
}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  const authHeader=String(req.headers.authorization||'');
  if(!/^Bearer\s/i.test(authHeader))return res.status(401).json({error:'AUTH_REQUIRED'});
  const token=authHeader.replace(/^Bearer\s+/i,'');
  const expected=env('HERMES_BCO_WRITE_TOKEN');
  if(!expected||!token||!safeEqual(token,expected))return res.status(401).json({error:'AUTH_REQUIRED'});
  if(env('HERMES_BCO_INGEST_ENABLED','false')!=='true')return res.status(200).json({ok:false,disabled:true,reason:'INGEST_DISABLED'});
  const credentials=supabaseRequestCredentials();
  if(!credentials?.apikey||credentials.mode!=='service')return res.status(503).json({error:'SERVER_DATABASE_CREDENTIAL_NOT_CONFIGURED'});
  try{
    const b=await body(req,20000),organization=clean(b.organization,80);
    if(organization!=='ne-e-m')return res.status(403).json({error:'ORGANIZATION_NOT_ENABLED'});
    const company_name=clean(b.company_name,200),domain=clean(b.domain,240).toLowerCase(),email=clean(b.email,320).toLowerCase();
    const source_url=clean(b.source_url,1000),source=clean(b.source,160),observed_at=clean(b.observed_at,50);
    if(!company_name||!source_url||!source||!observed_at||b.source_verified!==true)return res.status(400).json({error:'VERIFIED_SOURCE_FIELDS_REQUIRED'});
    if(domain&&!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))+$/.test(domain))return res.status(400).json({error:'DOMAIN_INVALID'});
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'EMAIL_INVALID'});
    let parsed;try{parsed=new URL(source_url);}catch{return res.status(400).json({error:'SOURCE_URL_INVALID'});}
    if(parsed.protocol!=='https:'||!parsed.hostname||parsed.username||parsed.password)return res.status(400).json({error:'HTTPS_SOURCE_REQUIRED'});
    const observed=new Date(observed_at);if(Number.isNaN(observed.getTime())||observed.getTime()>Date.now()+86400000||Date.now()-observed.getTime()>90*86400000)return res.status(400).json({error:'SOURCE_OBSERVATION_OUTSIDE_90_DAY_WINDOW'});
    const duplicateFilter=domain?'domain=eq.'+encodeURIComponent(domain):email?'email=eq.'+encodeURIComponent(email):'company_name=eq.'+encodeURIComponent(company_name);
    const existing=await rest('merch_prospects?select=id,company_name,domain,email&organization_id=eq.'+NRSM_ORG+'&'+duplicateFilter+'&limit=1',credentials);
    if(Array.isArray(existing)&&existing.length)return res.status(200).json({ok:true,duplicate:true,prospect:existing[0],message:'Existing prospect retained; no duplicate created.'});
    const row={organization_id:NRSM_ORG,company_name,domain:domain||null,contact_name:clean(b.contact_name,160)||null,email:email||null,phone:clean(b.phone,80)||null,source,source_url,fit_score:Number.isInteger(b.fit_score)?Math.max(0,Math.min(100,b.fit_score)):null,status:'discovered',notes:clean(b.notes,1500)||null,metadata:{source_verified:true,observed_at:observed.toISOString(),outreach_eligible:false,legal_basis:'unknown',ingested_by:'hermes'}};
    const created=await rest('merch_prospects?select=id,company_name,domain,email,status,metadata',credentials,{method:'POST',headers:{prefer:'return=representation'},body:JSON.stringify(row)});
    return res.status(201).json({ok:true,created:created?.[0]||null,outreach_eligible:false,send_authorized:false});
  }catch(e){return res.status(Number(e.status)||500).json({error:e.message||'PROSPECT_INGEST_FAILED'});}
}
