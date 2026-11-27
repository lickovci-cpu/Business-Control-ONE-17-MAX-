import {getSupabaseRuntimeConfig,isPreviewRuntime} from './_lib.js';
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Vary','Host');
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'METHOD_NOT_ALLOWED'});
  try{const config=getSupabaseRuntimeConfig();return res.status(200).json({ok:true,...config,environment:isPreviewRuntime()?'preview':'production'});}
  catch(e){return res.status(503).json({ok:false,error:String(e?.message||'SUPABASE_RUNTIME_CONFIG_INVALID')});}
}