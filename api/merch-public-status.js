import { env } from './_lib.js';

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'METHOD'});
  res.setHeader('Cache-Control','no-store');
  return res.json({ok:true,providers:{hunter:!!env('HUNTER_API_KEY'),openai:!!env('OPENAI_API_KEY'),fal:!!env('FAL_KEY'),gemini:!!env('GEMINI_API_KEY')},commerce:{bcoIntegrationSecret:!!env('BCO_INTEGRATION_SECRET')},communications:{email:!!(env('GMAIL_CLIENT_ID')&&env('GMAIL_CLIENT_SECRET')&&env('GMAIL_REFRESH_TOKEN')&&env('GMAIL_FROM')),whatsapp:!!(env('WHATSAPP_ACCESS_TOKEN')&&env('WHATSAPP_PHONE_NUMBER_ID'))}});
}
