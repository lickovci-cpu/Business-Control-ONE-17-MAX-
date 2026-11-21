const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Runtime-neutral identity verifier shared by Vercel API handlers and Cloudflare Workers.
// Auth validates the JWT; PostgREST checks membership with the same user JWT and RLS.
export async function verifyOrganizationIdentity({authorization,organizationId,supabaseUrl,publishableKey,fetcher=fetch}){
  const match=String(authorization||'').match(/^Bearer\s+(.+)$/i);
  const token=String(match?.[1]||'').trim();
  if(!token||token.length>8192)return {ok:false,status:401,error:'SUPABASE_AUTH_REQUIRED'};
  const orgId=String(organizationId||'').trim().toLowerCase();
  if(!UUID_RE.test(orgId))return {ok:false,status:400,error:'INVALID_ORGANIZATION_ID'};
  const base=String(supabaseUrl||'').trim().replace(/\/$/,'');
  const key=String(publishableKey||'').trim();
  if(!base||!key)return {ok:false,status:503,error:'SUPABASE_AUTH_NOT_CONFIGURED'};
  try{
    const userRes=await fetcher(base+'/auth/v1/user',{
      headers:{apikey:key,Authorization:'Bearer '+token},
      signal:AbortSignal.timeout(7000)
    });
    if(!userRes.ok)return {ok:false,status:401,error:'SUPABASE_AUTH_INVALID'};
    const user=await userRes.json().catch(()=>null);
    const userId=String(user?.id||'').trim().toLowerCase();
    if(!UUID_RE.test(userId))return {ok:false,status:401,error:'SUPABASE_USER_INVALID'};
    const q=new URL(base+'/rest/v1/memberships');
    q.searchParams.set('select','organization_id,user_id,role');
    q.searchParams.set('organization_id','eq.'+orgId);
    q.searchParams.set('user_id','eq.'+userId);
    q.searchParams.set('limit','1');
    const memberRes=await fetcher(q,{
      headers:{apikey:key,Authorization:'Bearer '+token},
      signal:AbortSignal.timeout(7000)
    });
    if(!memberRes.ok)return {ok:false,status:403,error:'ORGANIZATION_MEMBERSHIP_CHECK_FAILED'};
    const rows=await memberRes.json().catch(()=>[]);
    const membership=Array.isArray(rows)?rows.find(row=>String(row?.organization_id||'').toLowerCase()===orgId&&String(row?.user_id||'').toLowerCase()===userId):null;
    if(!membership)return {ok:false,status:403,error:'ORGANIZATION_MEMBERSHIP_REQUIRED'};
    return {ok:true,userId,organizationId:orgId,role:String(membership.role||'').trim().slice(0,32),token,base,key};
  }catch{
    return {ok:false,status:503,error:'IDENTITY_PROVIDER_UNAVAILABLE'};
  }
}
