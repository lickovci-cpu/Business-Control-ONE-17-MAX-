import {noauth,env,supabaseServiceKey,supabaseBaseUrl,supabasePublishableKey,projectKey} from './_lib.js';
import {cloudAdmin} from './_cloud-auth.js';
import {commsStatus} from './_comms.js';
import {metaStatus} from './_meta-config.js';

async function healthAuth(req,project){
  if(await cloudAdmin(req,project))return true;
  const secret=env('CRON_SECRET');
  return !!secret&&req.headers?.authorization===`Bearer ${secret}`;
}

export default async function handler(req,res){
  let project;
  try{project=projectKey(req.query?.project||'jihoceske');}
  catch{return res.status(400).json({error:'INVALID_PROJECT'});}
  if(!await healthAuth(req,project))return noauth(res);
  res.setHeader('Cache-Control','no-store');
  const clientAuthConfigured=!!supabaseBaseUrl()&&!!supabasePublishableKey();
  const allMetaStatus=metaStatus();
  return res.json({
    ok:true,version:'17-max',project,cloud:true,
    supabase:{serverKeyConfigured:!!supabaseServiceKey(),clientAuthConfigured,privateStorageEnabled:env('BCO_PRIVATE_STORAGE_ENABLED','false')==='true',automaticBackups:false,snapshotDestinationConfigured:!!env('SUPABASE_SNAPSHOT_BUCKET')},
    security:{authConfigured:clientAuthConfigured,legacyAppPasswordConfigured:!!env('APP_PASSWORD'),legacySharedSessionAllowed:env('BCO_ALLOW_LEGACY_SHARED_SESSION','false')==='true',sessionConfigured:!!(env('APP_SESSION_SECRET')||env('APP_CONFIRM_SECRET')||env('APP_PASSWORD')),confirmationConfigured:!!(env('APP_CONFIRM_SECRET')||env('APP_PASSWORD')),cronSecretConfigured:!!env('CRON_SECRET')},
    ai:{gemini:!!env('GEMINI_API_KEY'),geminiFreeTierEnabled:env('AI_ALLOW_GEMINI_FREE_TIER','false')==='true',claude:!!env('ANTHROPIC_API_KEY'),openrouter:!!env('OPENROUTER_API_KEY'),openai:!!env('OPENAI_API_KEY'),custom:!!env('CUSTOM_AI_URL'),costMode:env('AI_COST_MODE','free-first'),paidProvidersEnabled:env('AI_ALLOW_PAID_PROVIDERS','false')==='true',paidFallbacks:env('AI_ALLOW_PAID_FALLBACKS','false')==='true',paidMerchApisEnabled:env('BCO_ALLOW_PAID_MERCH_APIS','false')==='true'},
    metaProjects:{[project]:allMetaStatus[project]||{}},kv:!!env('KV_REST_API_URL'),blob:!!env('BLOB_READ_WRITE_TOKEN'),legacyPublicUploadEnabled:env('BCO_LEGACY_PUBLIC_UPLOAD_ENABLED','false')==='true',supabaseSnapshots:false,comms:commsStatus()
  });
}
