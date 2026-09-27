import {auth,env,supabaseBaseUrl,supabasePublishableKey,supabaseBearerToken} from './_lib.js';

const PROJECT_ORGS=Object.freeze({
  jihoceske:'09fb6fc9-7ea9-46ac-a84b-bd9952784c0c',
  fve:'09fb6fc9-7ea9-46ac-a84b-bd9952784c0c',
  mazliprint:'2d971414-9329-4d0b-94df-66cb8413f00c',
  merch:'d2751286-da99-42c0-b8ac-6a2da8ecdabf',
  boost:'d2751286-da99-42c0-b8ac-6a2da8ecdabf'
});

function clean(v,max=240){return String(v??'').trim().slice(0,max);}

export async function cloudMember(req,project){
  const token=supabaseBearerToken(req);
  const organizationId=PROJECT_ORGS[String(project||'').toLowerCase()];
  if(!token||!organizationId)return false;
  const key=supabasePublishableKey();
  const base=supabaseBaseUrl();
  if(!key||!base)return false;
  try{
    const userRes=await fetch(base+'/auth/v1/user',{
      headers:{apikey:key,Authorization:'Bearer '+token},
      signal:AbortSignal.timeout(7000)
    });
    if(!userRes.ok)return false;
    const user=await userRes.json().catch(()=>null);
    const userId=clean(user?.id,120);
    if(!userId)return false;
    const q=new URL(base+'/rest/v1/memberships');
    q.searchParams.set('select','id');
    q.searchParams.set('organization_id','eq.'+organizationId);
    q.searchParams.set('user_id','eq.'+userId);
    q.searchParams.set('limit','1');
    const memberRes=await fetch(q,{
      headers:{apikey:key,Authorization:'Bearer '+token},
      signal:AbortSignal.timeout(7000)
    });
    if(!memberRes.ok)return false;
    const rows=await memberRes.json().catch(()=>[]);
    return Array.isArray(rows)&&rows.length>0;
  }catch{return false;}
}

export async function authOrCloud(req,project){
  if(auth(req))return true;
  return cloudMember(req,project);
}
