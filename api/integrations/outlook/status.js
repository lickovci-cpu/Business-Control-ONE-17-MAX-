import {noauth} from '../../_lib.js';
import {cloudAdmin} from '../../_cloud-auth.js';
import {outlookConnectionStatus} from '../../_outlook.js';

const NRSM_ORG='d2751286-da99-42c0-b8ac-6a2da8ecdabf';

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  if(!(await cloudAdmin(req,'merch')))return noauth(res);
  const organizationId=String(req.query?.organization_id||'');
  if(organizationId!==NRSM_ORG)return res.status(403).json({error:'ORGANIZATION_NOT_ALLOWED'});
  try{return res.json({provider:'microsoft_graph',...(await outlookConnectionStatus(NRSM_ORG))});}
  catch(error){return res.status(503).json({error:error.message||'STATUS_FAILED'});}
}
