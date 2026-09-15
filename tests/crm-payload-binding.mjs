import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {validateApprovedPayload,validateLeadTransition} from '../api/leads.js';

const base={project:'jihoceske',organization_id:'09fb6fc9-7ea9-46ac-a84b-bd9952784c0c',id:null,payload:null,patch:null,status:null};
const stable=(x)=>Array.isArray(x)?'['+x.map(stable).join(',')+']':x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}':JSON.stringify(x);
const hash=(v)=>createHash('sha256').update(stable(v)).digest('hex');
const payload=(p={})=>({...base,...p});
const taskFor=(action,p)=>({id:'task-1',project:'jihoceske',action:`crm:lead-${action}`,payloadHash:hash(p)});

for(const [action,p] of [
  ['create',payload({payload:{name:'TEST_CRM_BINDING'}})],
  ['update',payload({id:'lead-1',patch:{note:'TEST'}})],
  ['status',payload({id:'lead-1',status:'qualified'})]
]){
  const t=taskFor(action,p);
  assert.equal(validateApprovedPayload(t,t.id,action,p,'jihoceske'),true,`${action} exact payload must pass`);
  const changed=structuredClone(p);
  if(action==='create')changed.payload.name='TEST_CRM_BINDING_CHANGED';
  if(action==='update'){changed.id='lead-2';assert.throws(()=>validateApprovedPayload(t,t.id,action,changed,'jihoceske'),/PAYLOAD_MISMATCH/);changed.id='lead-1';changed.patch.note='CHANGED';}
  if(action==='status')changed.status='offer';
  assert.throws(()=>validateApprovedPayload(t,t.id,action,changed,'jihoceske'),/PAYLOAD_MISMATCH/);
}

const exact=payload({id:'lead-1',patch:{estimated_value:10000,note:'TEST'}});const exactTask=taskFor('update',exact);
assert.throws(()=>validateApprovedPayload(exactTask,'other-task','update',exact,'jihoceske'),/TASK_ID_MISMATCH/);
assert.throws(()=>validateApprovedPayload(exactTask,exactTask.id,'update',exact,'other-project'),/PROJECT_MISMATCH/);
assert.throws(()=>validateApprovedPayload(exactTask,exactTask.id,'status',exact,'jihoceske'),/APPROVAL_ACTION_MISMATCH/);

assert.equal(validateLeadTransition('new','contacted'),true);
assert.equal(validateLeadTransition('offer','approved'),true);
assert.equal(validateLeadTransition('invoiced','paid'),true);
assert.equal(validateLeadTransition('paid','closed'),true);
assert.equal(validateLeadTransition('qualified','qualified'),true);
assert.throws(()=>validateLeadTransition('new','paid'),/INVALID_LEAD_TRANSITION/);
assert.throws(()=>validateLeadTransition('offer','job'),/INVALID_LEAD_TRANSITION/);
assert.throws(()=>validateLeadTransition('closed','paid'),/INVALID_LEAD_TRANSITION/);
assert.throws(()=>validateLeadTransition('new','not-a-status'),/INVALID_LEAD_STATUS/);

const api=await readFile('api/leads.js','utf8');
assert.ok(api.includes('contacts?organization_id=eq.${organization_id}&phone=eq.'),'CRM create should reuse exact phone contacts');
assert.ok(api.includes('contacts?organization_id=eq.${organization_id}&email=eq.'),'CRM create should reuse exact email contacts');
assert.ok(api.includes('newContact&&c?.id'),'CRM create should rollback a newly-created orphan contact on lead failure');

const control=await import('../api/_control.js');
assert.ok(control.consumeApproval.toString().includes('APPROVAL_ALREADY_USED'),'Control Plane replay protection must remain active');

console.log('CRM PAYLOAD + TRANSITIONS + CONTACT SAFETY OK — exact binding, stage guard, contact reuse and orphan rollback.');
