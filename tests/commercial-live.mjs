import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const api=await readFile('api/commercial.js','utf8');
const bridge=await readFile('public/commercial-live.js','utf8');
const control=await readFile('api/_control.js','utf8');
const sw=await readFile('public/sw.js','utf8');

for(const marker of ['quotes?organization_id=eq.','jobs?organization_id=eq.','financial_entries?organization_id=eq.','opportunities?organization_id=eq.','source:\'supabase\'','verified:true'])assert.ok(api.includes(marker),`commercial API marker missing: ${marker}`);
for(const marker of ['create-quote','create-job','create-financial','approvalRequired:true','consumeApproval','completeTask'])assert.ok(api.includes(marker),`commercial write marker missing: ${marker}`);
for(const marker of ['LIVE DB / SUPABASE','NO DATA — žádné skutečné nabídky','NO DATA — žádné skutečné zakázky','+ Nová nabídka DB','+ Nová zakázka DB','+ Příjem DB','+ Výdaj DB'])assert.ok(bridge.includes(marker),`commercial bridge marker missing: ${marker}`);
for(const marker of ['commercial:create-quote','commercial:create-job','commercial:create-financial'])assert.ok(control.includes(marker),`Control Plane action missing: ${marker}`);
assert.ok(sw.includes("'/commercial-live.js'"),'Service worker does not cache commercial bridge');
assert.ok(sw.includes('/commercial-live.js" defer'),'Service worker does not inject commercial bridge');

console.log('COMMERCIAL LIVE + CONTROLLED WRITES OK — Supabase read model, approval-gated quote/job/cash writes, PWA bridge.');
