import {auth,noauth,body,projectKey,sendError} from './_lib.js';
import {createTask,getTask,listTasks,requestApproval,consumeApproval,startAttempt,completeTask,blockTask,failAttempt,isMutatingAction} from './_control.js';

export default async function handler(req,res){
  if(!auth(req))return noauth(res);
  try{
    const action=String(req.query?.action||'list');
    if(req.method==='GET'){
      const project=projectKey(req.query?.project||'jihoceske');
      if(action==='task'){const task=await getTask(String(req.query?.id||''));if(!task)return res.status(404).json({error:'TASK_NOT_FOUND'});if(task.project!==project)return res.status(409).json({error:'PROJECT_MISMATCH'});return res.json({ok:true,task});}
      return res.json({ok:true,project,tasks:await listTasks(project)});
    }
    if(req.method!=='POST')return res.status(405).json({error:'METHOD'});
    const b=await body(req,700000);
    if(action==='create'){
      const project=projectKey(b.project||'jihoceske');
      const task=await createTask({project,agent:b.agent,action:b.action,payload:b.payload||{},actor:b.actor||'agent',evidenceRequired:b.evidenceRequired!==false});
      return res.status(201).json({ok:true,task,policy:{mutating:isMutatingAction(task.action),approvalRequired:isMutatingAction(task.action)}});
    }
    if(action==='approve')return res.json({ok:true,...await requestApproval(String(b.taskId||''),req)});
    if(action==='consume-approval')return res.json({ok:true,task:await consumeApproval(String(b.taskId||''),String(b.approvalToken||''),req)});
    if(action==='start')return res.json({ok:true,task:await startAttempt(String(b.taskId||''),req)});
    if(action==='complete')return res.json({ok:true,task:await completeTask(String(b.taskId||''),b.evidence,req)});
    if(action==='block')return res.json({ok:true,task:await blockTask(String(b.taskId||''),b.reason,b.nextStep,req)});
    if(action==='fail')return res.json({ok:true,task:await failAttempt(String(b.taskId||''),b.error,req)});
    return res.status(400).json({error:'UNKNOWN_ACTION'});
  }catch(e){return sendError(res,e);}
}
