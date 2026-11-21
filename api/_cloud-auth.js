import {auth,env,supabaseBaseUrl,supabasePublishableKey,supabaseBearerToken} from './_lib.js';
import {verifyOrganizationIdentity} from './_cloud-identity-core.js';

const PROJECT_ORGS=Object.freeze({
  jihoceske:'09fb6fc9-7ea9-46ac-a84b-bd9952784c0c',
  fve:'09fb6fc9-7ea9-46ac-a84b-bd9952784c0c',
  mazliprint:'2d971414-9329-4d0b-94df-66cb8413f00c',
  merch:'d2751286-da99-42c0-b8ac-6a2da8ecdabf',
  boost:'d2751286-da99-42c0-b8ac-6a2da8ecdabf'
});

export async function cloudIdentityForOrganization(req,organizationId){
  return verifyOrganizationIdentity({
    authorization:req.headers?.authorization,
    organizationId,
    supabaseUrl:supabaseBaseUrl(),
    publishableKey:supabasePublishableKey()
  });
}

export async function cloudIdentityForProject(req,project){
  const organizationId=PROJECT_ORGS[String(project||'').toLowerCase()];
  if(!organizationId)return {ok:false,status:400,error:'PROJECT_ORGANIZATION_NOT_CONFIGURED'};
  return cloudIdentityForOrganization(req,organizationId);
}

export async function cloudMember(req,project){
  const identity=await cloudIdentityForProject(req,project);
  return identity.ok;
}

export async function cloudAdmin(req,project){
  const identity=await cloudIdentityForProject(req,project);
  return identity.ok&&['owner','admin'].includes(String(identity.role||'').toLowerCase());
}

// A supplied Supabase JWT always wins and must belong to the selected org.
// Shared bc_session is disabled by default and can only be restored temporarily
// with an explicit server-side migration flag.
export async function authOrCloud(req,project){
  if(supabaseBearerToken(req))return cloudMember(req,project);
  return env('BCO_ALLOW_LEGACY_SHARED_SESSION','false')==='true'&&auth(req);
}
