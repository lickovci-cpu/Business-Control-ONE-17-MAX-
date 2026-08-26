import {env} from './_lib.js';
import {commsStatus} from './_comms.js';
import {metaStatus} from './_meta-config.js';
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  res.json({ok:true,version:'17-max',cloud:true,security:{authConfigured:!!env('APP_PASSWORD'),sessionConfigured:!!(env('APP_SESSION_SECRET')||env('APP_CONFIRM_SECRET')||env('APP_PASSWORD')),confirmationConfigured:!!(env('APP_CONFIRM_SECRET')||env('APP_PASSWORD')),cronSecretConfigured:!!env('CRON_SECRET')},ai:{gemini:!!env('GEMINI_API_KEY'),claude:!!env('ANTHROPIC_API_KEY'),openrouter:!!env('OPENROUTER_API_KEY'),custom:!!env('CUSTOM_AI_URL'),costMode:env('AI_COST_MODE','free-first'),paidFallbacks:env('AI_ALLOW_PAID_FALLBACKS','false')==='true'},metaProjects:metaStatus(),kv:!!env('KV_REST_API_URL'),blob:!!env('BLOB_READ_WRITE_TOKEN'),supabaseSnapshots:true,comms:commsStatus()});
}
