import {env,supabaseBaseUrl,supabaseRequestCredentials,safeEqual} from '../../_lib.js';

const ALLOWED_SLUGS=new Set(['ne-e-m','local-proof-factory']);
function boundedInt(v,def=50,min=1,max=100){const n=Number(v);return Number.isInteger(n)?Math.max(min,Math.min(max,n)):def;}
async function rest(path,credentials){
  const r=await fetch(supabaseBaseUrl()+'/rest/v1/'+path,{headers:{apikey:credentials.apikey,authorization:credentials.authorization,accept:'application/json'}});
  const data=await r.json().catch(()=>null);
  if(!r.ok)throw new Error('SUPABASE_READ_FAILED_'+r.status);
  return data;
}
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  const authHeader=String(req.headers.authorization||'');
  if(!/^Bearer\s/i.test(authHeader))return res.status(401).json({error:'AUTH_REQUIRED'});
  const token=authHeader.replace(/^Bearer\s+/i,'');
  const expected=env('HERMES_BCO_READ_TOKEN');
  if(!expected||!token||!safeEqual(token,expected))return res.status(401).json({error:'AUTH_REQUIRED'});
  const slug=String(req.query?.organization||'ne-e-m').trim().toLowerCase();
  if(!ALLOWED_SLUGS.has(slug))return res.status(400).json({error:'ORGANIZATION_NOT_ALLOWED'});
  const credentials=supabaseRequestCredentials();
  if(!credentials?.apikey||credentials.mode!=='service')return res.status(503).json({error:'SERVER_DATABASE_CREDENTIAL_NOT_CONFIGURED'});
  try{
    const orgs=await rest('organizations?select=id,name,slug&slug=eq.'+encodeURIComponent(slug)+'&limit=2',credentials);
    if(!Array.isArray(orgs)||orgs.length!==1)return res.status(404).json({error:'ORGANIZATION_NOT_FOUND_OR_AMBIGUOUS'});
    const org=orgs[0],limit=boundedInt(req.query?.limit);
    const [prospects,leads]=await Promise.all([
      slug==='ne-e-m'?rest('merch_prospects?select=id,company_name,domain,contact_name,email,phone,source,source_url,fit_score,status,notes,metadata,updated_at&organization_id=eq.'+org.id+'&order=updated_at.desc&limit='+limit,credentials):Promise.resolve([]),
      rest('leads?select=id,contact_id,source,status,note,next_action_at,created_at,contacts(id,name,email,phone)&organization_id=eq.'+org.id+'&order=created_at.desc&limit='+limit,credentials)
    ]);
    return res.status(200).json({ok:true,readOnly:true,organization:{id:org.id,name:org.name,slug:org.slug},prospects,leads,limits:{max:100,returned:prospects.length+leads.length},note:'Read-only endpoint. No CRM writes and no outbound messages.'});
  }catch(e){return res.status(502).json({error:e.message||'READ_FAILED'});}
}
