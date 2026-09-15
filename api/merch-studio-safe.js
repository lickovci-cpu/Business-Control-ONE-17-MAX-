import handler from './merch-studio.js';

export default async function safeHandler(req,res){
  const original=process.env.MERCH_CREATIVE_PROVIDERS;
  const configured=[];
  if(process.env.OPENAI_API_KEY)configured.push('openai');
  if(process.env.FAL_KEY)configured.push('fal');
  process.env.MERCH_CREATIVE_PROVIDERS=configured.join(',')||'openai';
  try{return await handler(req,res);}finally{
    if(original===undefined)delete process.env.MERCH_CREATIVE_PROVIDERS;else process.env.MERCH_CREATIVE_PROVIDERS=original;
  }
}
