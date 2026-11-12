import {auth,noauth} from '../../_lib.js';
import {outlookConnectionStatus} from '../../_outlook.js';
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  if(!auth(req))return noauth(res);
  try{
    const organizationId=String(req.query?.organization_id||'');
    if(!/^[0-9a-f-]{36}$/i.test(organizationId))return res.status(400).json({error:'ORGANIZATION_ID_REQUIRED'});
    return res.json({provider:'microsoft_graph',...(await outlookConnectionStatus(organizationId))});
  }catch(e){return res.status(503).json({error:e.message||'STATUS_FAILED'});}
}
