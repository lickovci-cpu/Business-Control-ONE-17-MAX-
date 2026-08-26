import {env,projectKey} from './_lib.js';
const prefix={jihoceske:'META_JIHOCESKE',mazliprint:'META_MAZLIPRINT',merch:'META_MERCH',boost:'META_BOOST',tepovani:'META_TEPOVANI'};
export function metaConfig(project){
  const k=projectKey(project),p=prefix[k];
  const fallback=k==='jihoceske';
  const token=env(`${p}_PAGE_TOKEN`)||(fallback?env('META_PAGE_TOKEN'):'');
  const userToken=env(`${p}_USER_TOKEN`)||(fallback?(env('META_USER_TOKEN')||env('META_ACCESS_TOKEN')):'');
  const pageId=env(`${p}_PAGE_ID`)||(fallback?env('META_PAGE_ID'):'');
  const igId=env(`${p}_IG_ID`)||(fallback?env('META_IG_ID'):'');
  const adAccountId=env(`${p}_AD_ACCOUNT_ID`)||(fallback?env('META_AD_ACCOUNT_ID'):'');
  return {project:k,token,userToken,pageId,igId,adAccountId,configured:!!((token||userToken)&&pageId)};
}
export function metaStatus(){
  return Object.fromEntries(['jihoceske','mazliprint','merch','boost','tepovani'].map(k=>{const c=metaConfig(k);return [k,{configured:c.configured,pageId:!!c.pageId,ig:!!c.igId,ads:!!c.adAccountId,userToken:!!c.userToken}]}));
}
