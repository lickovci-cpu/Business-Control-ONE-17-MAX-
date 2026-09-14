import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const api=await readFile('api/leads.js','utf8');
const control=await readFile('api/_control.js','utf8');
const bridge=await readFile('public/crm-live.js','utf8');
const sw=await readFile('public/sw.js','utf8');

for(const marker of ['CRM_DB_NOT_CONFIGURED','organization_id','execute-create','execute-update','execute-status','crm:lead-create','crm:lead-update','crm:lead-status'])assert.ok(api.includes(marker),`CRM API marker missing: ${marker}`);
for(const marker of ['crm:lead-create','crm:lead-update','crm:lead-status'])assert.ok(control.includes(marker),`Control Plane mutation marker missing: ${marker}`);
for(const marker of ['qualified','contacted','follow_up','offer','approved','job','delivered','invoiced','paid','closed','/api/leads'])assert.ok(bridge.includes(marker),`CRM bridge marker missing: ${marker}`);
assert.ok(sw.includes("/crm-live.js"),'PWA shell does not load CRM bridge');
console.log('CRM LIVE OK');
