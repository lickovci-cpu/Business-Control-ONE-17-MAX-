import {verifyOutlookState,exchangeOutlookCode,storeOutlookAuthorization} from '../../_outlook.js';
const NRSM_ORG='d2751286-da99-42c0-b8ac-6a2da8ecdabf';
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  if(req.query?.error)return res.status(400).json({error:'MICROSOFT_OAUTH_DENIED',detail:String(req.query.error).slice(0,80)});
  try{
    const state=verifyOutlookState(req.query?.state);
    if(state.organizationId!==NRSM_ORG)return res.status(403).json({error:'ORGANIZATION_NOT_ALLOWED'});
    const code=String(req.query?.code||'');
    if(!code)return res.status(400).json({error:'OAUTH_CODE_MISSING'});
    const token=await exchangeOutlookCode(code);
    await storeOutlookAuthorization(state.organizationId,token);
    return res.status(200).json({ok:true,provider:'microsoft_graph',organization_id:state.organizationId,scopes:String(token.scope||'').split(/\s+/),message:'OAuth connected. No email was sent.'});
  }catch(e){return res.status(400).json({error:e.message||'OAUTH_CALLBACK_FAILED'});}
}
