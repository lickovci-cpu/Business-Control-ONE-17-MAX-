import {noauth} from '../../_lib.js';
import {authOrCloud} from '../../_cloud-auth.js';
import {createOutlookState,outlookAuthorizationUrl} from '../../_outlook.js';
const NRSM_ORG='d2751286-da99-42c0-b8ac-6a2da8ecdabf';
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  if(!(await authOrCloud(req,'merch')))return noauth(res);
  try{
    const organizationId=String(req.query?.organization_id||'');
    if(organizationId!==NRSM_ORG)return res.status(403).json({error:'ORGANIZATION_NOT_ALLOWED'});
    return res.redirect(302,outlookAuthorizationUrl(createOutlookState(organizationId)));
  }catch(e){return res.status(400).json({error:e.message||'OUTLOOK_CONNECT_FAILED'});}
}
