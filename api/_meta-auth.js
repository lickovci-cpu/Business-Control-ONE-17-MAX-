import {graph} from './_lib.js';
import {metaConfig} from './_meta-config.js';

const cache=new Map();
const CACHE_MS=8*60*1000;
const tokenError=e=>Number(e?.code)===190||/access token|session has expired|oauth/i.test(String(e?.message||''));
const publicError=e=>({message:String(e?.message||'Meta chyba').slice(0,260),code:e?.code||null,subcode:e?.subcode||null});

async function validate(c,token){
  const j=await graph(`${c.pageId}`,{fields:'id,name'},'GET',token);
  return {id:String(j.id||''),name:String(j.name||'')};
}
async function derivePageToken(c){
  if(!c.userToken)return null;
  try{
    const j=await graph(`${c.pageId}`,{fields:'id,name,access_token'},'GET',c.userToken);
    if(j?.access_token)return {token:String(j.access_token),name:String(j.name||''),source:'user-token'};
  }catch{}
  try{
    const j=await graph('me/accounts',{fields:'id,name,access_token',limit:100},'GET',c.userToken);
    const row=(j.data||[]).find(x=>String(x.id)===String(c.pageId));
    if(row?.access_token)return {token:String(row.access_token),name:String(row.name||''),source:'user-token-accounts'};
  }catch{}
  return null;
}
export async function resolveMeta(project,{allowInvalid=false}={}){
  const c=metaConfig(project),now=Date.now(),hit=cache.get(c.project);
  if(hit&&hit.until>now)return {...c,...hit.value};
  if(!c.pageId||(!c.token&&!c.userToken)){
    const value={valid:false,state:'not_configured',token:'',recovered:false,error:null};
    cache.set(c.project,{until:now+30000,value});
    if(allowInvalid)return {...c,...value};
    const e=new Error('META_NOT_CONFIGURED_FOR_PROJECT');e.status=409;throw e;
  }
  let firstError=null;
  if(c.token){
    try{
      const info=await validate(c,c.token),value={valid:true,state:'ready',token:c.token,recovered:false,pageName:info.name,error:null};
      cache.set(c.project,{until:now+CACHE_MS,value});return {...c,...value};
    }catch(e){firstError=e;if(!tokenError(e)&&!c.userToken){if(!allowInvalid)throw e;}}
  }
  if(c.userToken){
    try{
      const derived=await derivePageToken(c);
      if(derived?.token){
        const info=await validate(c,derived.token),value={valid:true,state:'recovered',token:derived.token,recovered:true,pageName:info.name||derived.name,error:null};
        cache.set(c.project,{until:now+CACHE_MS,value});return {...c,...value};
      }
    }catch(e){firstError=firstError||e;}
  }
  const expired=tokenError(firstError),value={valid:false,state:expired?'expired':'error',token:'',recovered:false,error:publicError(firstError||new Error('Meta token nelze ověřit.'))};
  cache.set(c.project,{until:now+60000,value});
  if(allowInvalid)return {...c,...value};
  const e=new Error(expired?'META_TOKEN_EXPIRED':'META_TOKEN_INVALID');e.status=401;e.code=firstError?.code;e.subcode=firstError?.subcode;throw e;
}
export function clearMetaCache(project){if(project)cache.delete(project);else cache.clear();}
