import {auth,noauth,body,env,projectKey,sendError} from './_lib.js';
import {recordAiRun} from './_ai-ledger.js';

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
const JSON_TASKS=new Set(['command','visual','select','weekly','reel','contentpiece','reelhooks','campaign','leadkit','salescoach','quote','crm','product']);
function providerModel(provider){return ({gemini:env('GEMINI_MODEL','gemini-3.5-flash-lite'),claude:env('ANTHROPIC_MODEL','claude-haiku-4-5'),openrouter:env('OPENROUTER_MODEL','openrouter/free'),openai:env('OPENAI_MODEL','gpt-5.6-luna'),custom:env('CUSTOM_AI_MODEL','custom')})[provider]||null;}
function parseStructuredOutput(task,text){if(!JSON_TASKS.has(task))return null;const raw=String(text||'').trim().replace(/^\`\`\`(?:json)?\\s*/i,'').replace(/\\s*\`\`\`$/,'');try{return JSON.parse(raw);}catch{return null;}}
function hasObject(value){return Boolean(value&&typeof value==='object'&&!Array.isArray(value));}
function nonEmptyString(value){return typeof value==='string'&&value.trim().length>0;}
function validateStructuredOutput(task,value){
  if(!JSON_TASKS.has(task)||value===null||value===undefined)return !JSON_TASKS.has(task);
  if(task==='select'||task==='weekly'||task==='reelhooks'){
    if(!Array.isArray(value))return false;
    if(task==='select')return value.length>=1&&value.length<=10&&value.every(nonEmptyString);
    if(task==='weekly')return value.length===7&&value.every(x=>hasObject(x)&&nonEmptyString(x.topic)&&nonEmptyString(x.postText));
    return value.length===5&&value.every(nonEmptyString);
  }
  if(!hasObject(value))return false;
  const required={
    command:['intent','project','goal','tasks','notes'],
    visual:['photos','coverPhotoId','albumOrder','summary'],
    reel:['title','hook','shotList','caption','cta'],
    contentpiece:['format','title','caption','cta','hashtags'],
    campaign:['title','goal','post','stories','carousel','reel','cta','hashtags','publishOrder','notes'],
    leadkit:['fitReason','priority','subject','firstMessage','whatsapp','questions','followUps','objections','nextStep','crmNote'],
    salescoach:['priority','goal','nextStep','verify','risks','message','reason'],
    quote:['scope','verify','exclusions','handoff'],
    crm:['priorities','followUps','risks','nextActions'],
    product:['positioning','customer','offer','marginRisk','contentIdeas','tests','nextAction']
  }[task]||[];
  if(required.some(k=>!(k in value)))return false;
  if(['tasks','notes','photos','shotList','hashtags','questions','objections','scope','verify','exclusions','handoff','priorities','risks','nextActions','contentIdeas','tests','stories','carousel','publishOrder'].some(k=>k in value)&&
     Object.entries(value).some(([k,v])=>['tasks','notes','photos','shotList','hashtags','questions','objections','scope','verify','exclusions','handoff','priorities','followUps','risks','nextActions','contentIdeas','tests','stories','carousel','publishOrder'].includes(k)&&!Array.isArray(v)))return false;
  if(task==='campaign'&&(!Array.isArray(value.stories)||value.stories.length!==3||!Array.isArray(value.carousel)||value.carousel.length!==5))return false;
  if(task==='reel'&&!Array.isArray(value.shotList))return false;
  if(task==='visual'&&(!Array.isArray(value.photos)||value.photos.length<1||!Array.isArray(value.albumOrder)))return false;
  if(task==='leadkit'&&(!hasObject(value.followUps)||!hasObject(value.objections)))return false;
  return true;
}
async function checkedFetch(url,opt,label){let r;try{r=await fetch(url,{...opt,signal:AbortSignal.timeout(55000)})}catch(e){throw new Error(`${label}: ${e.name==='TimeoutError'?'timeout':'network error'}`)}const j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.error?.message||j.error_description||j.error||`${label} HTTP ${r.status}`);e.status=r.status;throw e;}return j;}
async function gemini(parts,maxTokens){const key=env('GEMINI_API_KEY');if(!key)throw new Error('GEMINI_API_KEY není nastaven.');const model=env('GEMINI_MODEL','gemini-3.5-flash-lite'),j=await checkedFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:{maxOutputTokens:maxTokens}})},'Gemini');return j.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('')||'';}
async function openai(prompt,images,maxTokens){const key=env('OPENAI_API_KEY');if(!key)throw new Error('OPENAI_API_KEY není nastaven.');const model=env('OPENAI_MODEL','gpt-5.6-luna'),content=[{type:'input_text',text:prompt},...images.map(im=>({type:'input_image',image_url:`data:${im.mime};base64,${im.data}`}))],j=await checkedFetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'content-type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({model,input:[{role:'user',content}],max_output_tokens:maxTokens})},'OpenAI');const fallback=(j.output||[]).flatMap(x=>Array.isArray(x.content)?x.content:[]).map(x=>x.text||'').filter(Boolean).join('');return j.output_text||fallback||'';}
async function claude(prompt,images,maxTokens){const key=env('ANTHROPIC_API_KEY');if(!key)throw new Error('ANTHROPIC_API_KEY není nastaven.');const model=env('ANTHROPIC_MODEL','claude-haiku-4-5'),content=[{type:'text',text:prompt}];for(const im of images)content.push({type:'image',source:{type:'base64',media_type:im.mime,data:im.data}});const j=await checkedFetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},body:JSON.stringify({model,max_tokens:maxTokens,messages:[{role:'user',content}]})},'Claude');return (j.content||[]).map(x=>x.text||'').join('');}
function openAiContent(prompt,images){if(!images.length)return prompt;return [{type:'text',text:prompt},...images.map(im=>({type:'image_url',image_url:{url:`data:${im.mime};base64,${im.data}`}}))];}
async function openrouter(prompt,images,maxTokens){const key=env('OPENROUTER_API_KEY');if(!key)throw new Error('OPENROUTER_API_KEY není nastaven.');const model=env('OPENROUTER_MODEL','openrouter/free'),j=await checkedFetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'content-type':'application/json','HTTP-Referer':env('APP_PUBLIC_URL','https://business-control-one.vercel.app'),'X-Title':'Business Control ONE'},body:JSON.stringify({model,messages:[{role:'user',content:openAiContent(prompt,images)}],max_tokens:maxTokens})},'OpenRouter');return j.choices?.[0]?.message?.content||'';}
async function custom(prompt,images,maxTokens){const url=env('CUSTOM_AI_URL'),key=env('CUSTOM_AI_TOKEN'),model=env('CUSTOM_AI_MODEL');if(!url)throw new Error('CUSTOM_AI_URL není nastaven.');const j=await checkedFetch(url,{method:'POST',headers:{'content-type':'application/json',...(key?{Authorization:`Bearer ${key}`}:{})},body:JSON.stringify({model:model||undefined,messages:[{role:'user',content:openAiContent(prompt,images)}],max_tokens:maxTokens})},'Custom AI');return j.choices?.[0]?.message?.content||j.output_text||j.output?.[0]?.content?.[0]?.text||j.text||'';}
const available=()=>({gemini:!!env('GEMINI_API_KEY'),claude:!!env('ANTHROPIC_API_KEY'),openrouter:!!env('OPENROUTER_API_KEY'),openai:!!env('OPENAI_API_KEY'),custom:!!env('CUSTOM_AI_URL')});
export default async function handler(req,res){
  if(!auth(req))return noauth(res);
  try{
    if(req.method!=='POST')return res.status(405).json({error:'METHOD'});
    const startedAt=Date.now(),b=await body(req,3_800_000),task=String(b.task||'command').slice(0,40),project=projectKey(b.project||b.context?.projectKey||'jihoceske'),agent=String(b.agent||'ai').slice(0,80);
    const contextObj=stripPII({...b.context,projectKey:project}),context=JSON.stringify(contextObj).slice(0,30000),prompt=promptFor(task,b,context),maxTokens=tokenBudget(task),images=validateImages((b.images||[]).slice(0,10));
    const parts=[{text:prompt},...images.map(im=>({inline_data:{mime_type:im.mime,data:im.data}}))],reqProvider=String(b.provider||'auto').toLowerCase(),configured=available(),freeFirst=env('AI_COST_MODE','free-first')==='free-first',paidAllowed=env('AI_ALLOW_PAID_FALLBACKS','false')==='true';
    const order=reqProvider!=='auto'?[reqProvider]:env('AI_PROVIDER_ORDER',freeFirst?'gemini,openrouter,openai,claude':'gemini,openai,claude,openrouter').split(',').map(x=>x.trim()).filter(Boolean),errors=[],skipped=[],attemptedProviders=[];
    for(const p of order){
      if(!configured[p]){skipped.push(`${p}:nenastaven`);continue;}
      if(reqProvider==='auto'&&freeFirst&&['openai','claude'].includes(p)&&!paidAllowed){skipped.push(`${p}:placený fallback zakázán`);continue;}
      attemptedProviders.push(p);try{let text='';if(p==='gemini')text=await gemini(parts,maxTokens);else if(p==='claude')text=await claude(prompt,images,maxTokens);else if(p==='openrouter')text=await openrouter(prompt,images,maxTokens);else if(p==='openai')text=await openai(prompt,images,maxTokens);else if(p==='custom')text=await custom(prompt,images,maxTokens);else continue;const parsed=parseStructuredOutput(task,text),structuredValid=parsed!==null&&validateStructuredOutput(task,parsed),latencyMs=Date.now()-startedAt;if(!structuredValid&&reqProvider==='auto'&&JSON_TASKS.has(task)){const invalidError=`${p}:STRUCTURED_OUTPUT_INVALID`;errors.push(invalidError);await recordAiRun({project,agent,task,status:'invalid_output',provider:p,model:providerModel(p),requestedProvider:reqProvider,fallbackUsed:attemptedProviders.length>1,attemptedProviders,imageCount:images.length,outputChars:String(text||'').length,structuredExpected:true,structuredValid:false,latencyMs,error:'STRUCTURED_OUTPUT_INVALID'});continue;}await recordAiRun({project,agent,task,status:'completed',provider:p,model:providerModel(p),requestedProvider:reqProvider,fallbackUsed:attemptedProviders.length>1,attemptedProviders,imageCount:images.length,outputChars:String(text||'').length,structuredExpected:JSON_TASKS.has(task),structuredValid,latencyMs});return res.json({text,parsed,provider:p,model:providerModel(p),project,fallbackUsed:attemptedProviders.length>1,attemptedProviders,structuredExpected:JSON_TASKS.has(task),structuredValid,skipped});}catch(e){errors.push(`${p}: ${e.message}`);if(reqProvider!=='auto')throw e;}
    }
    const failure=errors.length?errors.join(' | '):`Není dostupný žádný povolený AI provider. ${skipped.join(' | ')}`;await recordAiRun({project,agent,task,status:'failed',provider:null,model:null,requestedProvider:reqProvider,fallbackUsed:attemptedProviders.length>1,attemptedProviders,imageCount:images.length,outputChars:0,structuredExpected:JSON_TASKS.has(task),structuredValid:false,latencyMs:Date.now()-startedAt,error:failure});throw new Error(failure);
  }catch(e){return sendError(res,e);}
}
