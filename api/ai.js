import {auth,noauth,body,env,projectKey,sendError} from './_lib.js';

function stripPII(v,depth=0){
  if(depth>8)return null;
  if(Array.isArray(v))return v.slice(0,80).map(x=>stripPII(x,depth+1));
  if(v&&typeof v==='object'){
    const out={};
    for(const [k,val] of Object.entries(v)){
      if(/^(contact|phone|telephone|email|to|address)$/i.test(k))continue;
      out[k]=stripPII(val,depth+1);
    }
    return out;
  }
  return typeof v==='string'?v.slice(0,4000):v;
}
function promptFor(task,b,context){
  if(task==='command')return `Jsi AI Business OS pro malou českou firmu. Z příkazu vytvoř konkrétní proveditelný plán. Vrať validní JSON s poli intent, project, goal, photoQuery, recommendedPhotosCount (1-10), postText, cta, hashtags(array), recommendedTime, tasks(array), notes(array), communication(optional objekt s channel,subject,text). Nevymýšlej fakta ani kontaktní údaje. Kontext:${context}\nPříkaz:${b.prompt||''}`;
  if(task==='visual')return `Analyzuj každou přiloženou firemní fotografii samostatně. Vrať POUZE validní JSON objekt: {"photos":[{"id":"ID_Z_KONTEXTU","visible":"co je bezpečně vidět","shotType":"typ záběru","quality":1-10,"marketingUse":"vhodné použití","claimRisks":["co z fotky nelze tvrdit"],"tags":["tag"]}],"coverPhotoId":"id","albumOrder":["id"],"summary":"stručné doporučení"}. Nevymýšlej technické skutečnosti, které nejsou vizuálně ověřitelné. Kontext:${context}`;
  if(task==='select')return `Vyber z katalogu fotografií nejlepší 1-10 položek pro téma. Vrať pouze validní JSON pole jejich id v pořadí použití. Dávej rozmanité záběry, ne duplicity. Kontext:${context}\nTéma:${b.prompt||''}`;
  if(task==='weekly')return `Vytvoř týdenní obsahový plán v češtině pro daný projekt. Vrať validní JSON pole 7 objektů: day,topic,goal,photoQuery,photosCount,postText,cta. Nevymýšlej fakta. Kontext:${context}`;
  if(task==='message')return `Napiš krátkou přirozenou obchodní zprávu v češtině podle zadání. Bez AI frází, bez přehnaných slibů. Vrať pouze finální text zprávy. Kontext:${context}\nZadání:${b.prompt||''}`;
  if(task==='reel')return `Jsi editor krátkých Reels pro malou českou firmu. Vytvoř realizovatelný plán z reálných dostupných záběrů/fotek, bez vymyšlených referencí. Vrať POUZE validní JSON objekt: {\"title\":\"\",\"hook\":\"\",\"duration\":30,\"goal\":\"\",\"shotList\":[{\"from\":0,\"to\":3,\"visual\":\"\",\"onScreenText\":\"\",\"voiceover\":\"\"}],\"caption\":\"\",\"cta\":\"\",\"hashtags\":[\"#...\"],\"musicMood\":\"\",\"editNotes\":[\"\"]}. První 2 sekundy musí mít silný hook. Texty krátké a přirozené. Nevymýšlej certifikace, ceny, počty realizací ani technická fakta mimo kontext. Kontext:${context}\nZadání:${b.prompt||''}`;
  if(task==='contentpiece')return `Vytvoř jeden konkrétní obsahový kus pro malou českou firmu. Vrať POUZE validní JSON objekt: {\"format\":\"post|story|carousel\",\"title\":\"\",\"slides\":[{\"headline\":\"\",\"text\":\"\",\"visual\":\"\"}],\"caption\":\"\",\"cta\":\"\",\"hashtags\":[\"#...\"]}. Pro story použij 3 krátké snímky, carousel 5 snímků, post může mít slides prázdné. Používej pouze fakta z kontextu, žádné vymyšlené ceny, certifikace ani reference. Kontext:${context}\nZadání:${b.prompt||''}`;
  if(task==='reelhooks')return `Vymysli 5 přirozených hooků do prvních 2 sekund Reelu pro malou českou firmu. Každý musí být krátký, konkrétní, bez clickbaitu a bez vymyšlených tvrzení. Vrať pouze JSON pole 5 řetězců. Kontext:${context}\nZadání:${b.prompt||''}`;
  if(task==='campaign')return `Jsi content strategist malé české firmy. Z jednoho cíle vytvoř mini-kampaň, která se dá skutečně realizovat. Vrať pouze validní JSON: {"title":"","goal":"","post":{"headline":"","caption":""},"stories":[{"headline":"","text":"","visual":""}],"carousel":[{"headline":"","text":"","visual":""}],"reel":{"hook":"","concept":""},"cta":"","hashtags":["#..."],"publishOrder":[""],"notes":[""]}. Stories přesně 3, carousel přesně 5. Používej jen fakta z kontextu. Nevymýšlej ceny, certifikace, zaměstnance, počty realizací ani reference. Kontext:${context}\nZadání:${b.prompt||''}`;
  if(task==='leadkit')return `Jsi B2B obchodník malé české firmy. Připrav follow-up kit podle leadu a skutečné nabídky. Vrať pouze JSON: {"fitReason":"","priority":"A|B|C","subject":"","firstMessage":"","whatsapp":"","questions":[""],"followUps":{"d2":"","d5":"","d10":""},"objections":[{"objection":"","answer":""}],"nextStep":"","crmNote":""}. Zprávy stručné, přirozené, bez přehnaných slibů. U FVE nikdy netvrď vlastní elektro/revizní oprávnění. Kontext:${context}`;
  if(task==='salescoach')return `Jsi obchodní kouč malé české firmy. Z jednoho leadu navrhni nejkratší realistickou cestu k dalšímu kroku. Vrať pouze JSON: {"priority":"A|B|C","goal":"","nextStep":"","verify":[""],"risks":[""],"message":"","reason":""}. Nevymýšlej kontakty, ceny, certifikace ani reference. U FVE elektro/revize jen jako externí spolupráce. Kontext:${context}`;
  if(task==='quote')return `Jsi přípravář nabídky malé české firmy. Navrhni pouze realizovatelný rozsah prací z dostupných faktů. Vrať pouze JSON: {"scope":[""],"verify":[""],"exclusions":[""],"handoff":[""]}. NIKDY nevymýšlej cenu, materiál, termín, počet lidí, certifikaci ani oprávnění. Pokud něco chybí, dej to do verify. U FVE elektro zapojení a revize formuluj pouze jako spolupráci s elektrikářem/revizním technikem. Kontext:${context}`;
  if(task==='crm')return `Analyzuj CRM pipeline malé firmy. Vrať validní JSON s poli priorities(array),followUps(array),risks(array),nextActions(array). Nevymýšlej kontakty ani fakta. Kontext:${context}`;
  if(task==='product')return `Proveď produktový audit. Vrať validní JSON s poli positioning,customer,offer,marginRisk,contentIdeas(array),tests(array),nextAction. Kontext:${context}`;
  return `Pomoz s řízením malé firmy. Kontext:${context}\n${b.prompt||''}`;
}
function validateImages(images){
  if(!Array.isArray(images))return[];if(images.length>10)throw new Error('MAX_10_IMAGES');let total=0;
  return images.map((im,i)=>{if(!im?.data||!im?.mime)throw new Error(`IMAGE_${i+1}_INVALID`);if(!['image/jpeg','image/png','image/webp'].includes(im.mime))throw new Error(`IMAGE_${i+1}_TYPE`);const bytes=Math.floor(String(im.data).length*3/4);if(bytes>480000)throw new Error(`IMAGE_${i+1}_TOO_LARGE`);total+=bytes;if(total>2800000)throw new Error('IMAGES_TOTAL_TOO_LARGE');return {mime:im.mime,data:String(im.data)};});
}
function tokenBudget(task){const hard=Math.max(128,Number(env('AI_MAX_OUTPUT_TOKENS','1800'))||1800),defaults={message:500,reel:1800,reelhooks:500,campaign:1800,leadkit:1500,salescoach:1200,quote:1200,contentpiece:1400,select:500,command:1200,weekly:1600,visual:1800,crm:1200,product:1200};return Math.min(hard,defaults[task]||1200);}
async function checkedFetch(url,opt,label){let r;try{r=await fetch(url,{...opt,signal:AbortSignal.timeout(55000)})}catch(e){throw new Error(`${label}: ${e.name==='TimeoutError'?'timeout':'network error'}`)}const j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.error?.message||j.error_description||j.error||`${label} HTTP ${r.status}`);e.status=r.status;throw e;}return j;}
async function gemini(parts,maxTokens){const key=env('GEMINI_API_KEY');if(!key)throw new Error('GEMINI_API_KEY není nastaven.');const model=env('GEMINI_MODEL','gemini-3.5-flash-lite'),j=await checkedFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{maxOutputTokens:maxTokens}})},'Gemini');return j.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('')||'';}
async function claude(prompt,images,maxTokens){const key=env('ANTHROPIC_API_KEY');if(!key)throw new Error('ANTHROPIC_API_KEY není nastaven.');const model=env('ANTHROPIC_MODEL','claude-haiku-4-5'),content=[{type:'text',text:prompt}];for(const im of images)content.push({type:'image',source:{type:'base64',media_type:im.mime,data:im.data}});const j=await checkedFetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},body:JSON.stringify({model,max_tokens:maxTokens,messages:[{role:'user',content}]})},'Claude');return (j.content||[]).map(x=>x.text||'').join('');}
function openAiContent(prompt,images){if(!images.length)return prompt;return [{type:'text',text:prompt},...images.map(im=>({type:'image_url',image_url:{url:`data:${im.mime};base64,${im.data}`}}))];}
async function openrouter(prompt,images,maxTokens){const key=env('OPENROUTER_API_KEY');if(!key)throw new Error('OPENROUTER_API_KEY není nastaven.');const model=env('OPENROUTER_MODEL','openrouter/free'),j=await checkedFetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'content-type':'application/json','HTTP-Referer':env('APP_PUBLIC_URL','https://business-control-one.vercel.app'),'X-Title':'Business Control ONE'},body:JSON.stringify({model,messages:[{role:'user',content:openAiContent(prompt,images)}],max_tokens:maxTokens})},'OpenRouter');return j.choices?.[0]?.message?.content||'';}
async function custom(prompt,images,maxTokens){const url=env('CUSTOM_AI_URL'),key=env('CUSTOM_AI_TOKEN'),model=env('CUSTOM_AI_MODEL');if(!url)throw new Error('CUSTOM_AI_URL není nastaven.');const j=await checkedFetch(url,{method:'POST',headers:{'content-type':'application/json',...(key?{Authorization:`Bearer ${key}`}:{})},body:JSON.stringify({model:model||undefined,messages:[{role:'user',content:openAiContent(prompt,images)}],max_tokens:maxTokens})},'Custom AI');return j.choices?.[0]?.message?.content||j.output_text||j.output?.[0]?.content?.[0]?.text||j.text||'';}
const available=()=>({gemini:!!env('GEMINI_API_KEY'),claude:!!env('ANTHROPIC_API_KEY'),openrouter:!!env('OPENROUTER_API_KEY'),custom:!!env('CUSTOM_AI_URL')});
export default async function handler(req,res){
  if(!auth(req))return noauth(res);
  try{
    if(req.method!=='POST')return res.status(405).json({error:'METHOD'});
    const b=await body(req,3_800_000),task=String(b.task||'command').slice(0,40),project=projectKey(b.project||b.context?.projectKey||'jihoceske');
    const contextObj=stripPII({...b.context,projectKey:project}),context=JSON.stringify(contextObj).slice(0,30000),prompt=promptFor(task,b,context),maxTokens=tokenBudget(task),images=validateImages((b.images||[]).slice(0,10));
    const parts=[{text:prompt},...images.map(im=>({inline_data:{mime_type:im.mime,data:im.data}}))],reqProvider=String(b.provider||'auto').toLowerCase(),configured=available(),freeFirst=env('AI_COST_MODE','free-first')==='free-first',paidAllowed=env('AI_ALLOW_PAID_FALLBACKS','false')==='true';
    const order=reqProvider!=='auto'?[reqProvider]:env('AI_PROVIDER_ORDER',freeFirst?'gemini,openrouter,claude':'gemini,claude,openrouter').split(',').map(x=>x.trim()).filter(Boolean),errors=[],skipped=[];
    for(const p of order){
      if(!configured[p]){skipped.push(`${p}:nenastaven`);continue;}
      if(reqProvider==='auto'&&freeFirst&&p==='claude'&&!paidAllowed){skipped.push('claude:placený fallback zakázán');continue;}
      try{let text='';if(p==='gemini')text=await gemini(parts,maxTokens);else if(p==='claude')text=await claude(prompt,images,maxTokens);else if(p==='openrouter')text=await openrouter(prompt,images,maxTokens);else if(p==='custom')text=await custom(prompt,images,maxTokens);else continue;return res.json({text,provider:p,project,skipped});}catch(e){errors.push(`${p}: ${e.message}`);if(reqProvider!=='auto')throw e;}
    }
    throw new Error(errors.length?errors.join(' | '):`Není dostupný žádný povolený AI provider. ${skipped.join(' | ')}`);
  }catch(e){return sendError(res,e);}
}
