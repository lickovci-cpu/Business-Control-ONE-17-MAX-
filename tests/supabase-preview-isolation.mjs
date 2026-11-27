import assert from 'node:assert/strict';
import {getSupabaseRuntimeConfig,isPreviewRuntime,supabaseBaseUrl,supabasePublishableKey,supabaseServiceKey,supabaseRequestCredentials} from '../api/_lib.js';
const keys=['BCO_RUNTIME_ENV','BCO_EXPECTED_SUPABASE_REF','VERCEL_ENV','NODE_ENV','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SERVICE_KEY'];
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
function clear(){for(const k of keys)delete process.env[k];}
try{
 clear();process.env.NODE_ENV='production';
 assert.equal(isPreviewRuntime(),false);
 assert.equal(supabaseBaseUrl(),'https://vjzzvopwecmwuccdidzq.supabase.co');
 assert.equal(supabasePublishableKey(),'sb_publishable_XAa2FyYnSZE9_3iZrbhD3g_F3mn-wI5');
 process.env.VERCEL_ENV='preview';assert.equal(isPreviewRuntime(),true);
 assert.throws(()=>getSupabaseRuntimeConfig(),/PREVIEW_SUPABASE_REF_REQUIRED/);
 process.env.BCO_EXPECTED_SUPABASE_REF='pflfbphulvutccvvhrot';
 assert.throws(()=>getSupabaseRuntimeConfig(),/PREVIEW_SUPABASE_URL_REQUIRED/);
 process.env.SUPABASE_URL='https://vjzzvopwecmwuccdidzq.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_preview_test';
 assert.throws(()=>getSupabaseRuntimeConfig(),/PREVIEW_SUPABASE_PROJECT_MISMATCH/);
 process.env.SUPABASE_URL='https://pflfbphulvutccvvhrot.supabase.co';
 process.env.SUPABASE_SECRET_KEY='must-never-be-used-in-preview';process.env.SUPABASE_SERVICE_ROLE_KEY='must-never-be-used-in-preview';process.env.SUPABASE_SERVICE_KEY='must-never-be-used-in-preview';
 const config=getSupabaseRuntimeConfig();assert.equal(config.environment,'preview');assert.equal(config.projectRef,'pflfbphulvutccvvhrot');
 assert.equal(supabaseBaseUrl(),'https://pflfbphulvutccvvhrot.supabase.co');assert.equal(supabasePublishableKey(),'sb_publishable_preview_test');
 assert.equal(supabaseServiceKey(),'');assert.equal(supabaseRequestCredentials({headers:{}}),null);
 const credentials=supabaseRequestCredentials({headers:{authorization:'Bearer test-user-jwt'}});
 assert.equal(credentials.mode,'user');assert.equal(credentials.apikey,'sb_publishable_preview_test');assert.equal(credentials.authorization,'Bearer test-user-jwt');
 process.env.SUPABASE_URL='https://pflfbphulvutccvvhrot.supabase.co.evil.example';
 assert.throws(()=>getSupabaseRuntimeConfig(),/PREVIEW_SUPABASE_PROJECT_MISMATCH/);
 console.log('SUPABASE PREVIEW ISOLATION TESTS PASSED');
}finally{for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
