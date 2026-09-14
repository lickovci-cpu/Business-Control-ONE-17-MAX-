import {auth,noauth,body,projectKey,sendError} from './_lib.js';
import {createTask,getTask,listTasks,requestApproval,consumeApproval,startAttempt,completeTask,blockTask,failAttempt,isMutatingAction} from './_control.js';

async function taskForProject(taskId,project){const task=await getTask(taskId);if(!task)throw Object.assign(new Error('TASK_NOT_FOUND'),{status:404});if(task.project!==project)throw Object.assign(new Error('PROJECT_MISMATCH'),{status:409});return task;}

export default async function handler(req,res){
  if(!auth(req))return noauth(res);
  try{
    const action=String(req.query?.action||'list');
    if(req.method==='GET'){
      const project=projectKey(req.query?.project||'jihoceske');
      if(action==='task'){const task=await taskForProject(String(req.query?.id||''),project);return res.json({ok:true,task});}
      return res.json({ok:true,project,tasks:await listTasks(project)});
    }
    if(req.method!=='POST')return res.status(405).json({error:'METHOD'});
    const b=await body(req,700000);
    const project=projectKey(b.project||req.query?.project||'jihoceske');
    if(action==='create'){
      const task=await createTask({project,agent:b.agent,action:b.action,payload:b.payload||{},actor:b.actor||'agent',evidenceRequired:b.evidenceRequired!==false});
      return res.status(201).json({ok:true,task,policy:{mutating:isMutatingAction(task.action),approvalRequired:isMutatingAction(task.action)}});
    }
    if(action==='approve'){await taskForProject(String(b.taskId||''),project);return res.json({ok:true,...await requestApproval(String(b.taskId||''),req,project)});}
    if(action==='consume-approval'){await taskForProject(String(b.taskId||''),project);return res.json({ok:true,task:await consumeApproval(String(b.taskId||''),String(b.approvalToken||''),req,project)});}
    if(action==='start'){await taskForProject(String(b.taskId||''),project);return res.json({ok:true,task:await startAttempt(String(b.taskId||''),req,project)});
    }
    if(action==='complete'){
      await taskForProject(String(b.taskId||''),project);
      const e=new Error('RESULT_BINDING_REQUIRED');e.status=409;throw e;
    }
    if(action==='block'){await taskForProject(String(b.taskId||''),project);return res.json({ok:true,task:await blockTask(String(b.taskId||''),b.reason,b.nextStep,req,project)});}
    if(action==='fail'){await taskForProject(String(b.taskId||''),project);return res.json({ok:true,task:await failAttempt(String(b.taskId||''),b.error,req,project)});}
    return res.status(400).json({error:'UNKNOWN_ACTION'});
  }catch(e){return sendError(res,e);}
}
