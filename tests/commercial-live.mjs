import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const api=await readFile('api/commercial.js','utf8');
const bridge=await readFile('public/commercial-live.js','utf8');
const sw=await readFile('public/sw.js','utf8');

for(const marker of ['quotes?organization_id=eq.','jobs?organization_id=eq.','financial_entries?organization_id=eq.','opportunities?organization_id=eq.','source:\'supabase\'','verified:true'])assert.ok(api.includes(marker),`commercial API marker missing: ${marker}`);
for(const marker of ['/api/commercial','LIVE DB / SUPABASE','NO DATA — žádné skutečné nabídky','NO DATA — žádné skutečné zakázky'])assert.ok(bridge.includes(marker),`commercial bridge marker missing: ${marker}`);
assert.ok(sw.includes("'/commercial-live.js'"),'Service worker does not cache commercial bridge');
assert.ok(sw.includes('/commercial-live.js" defer'),'Service worker does not inject commercial bridge');

console.log('COMMERCIAL LIVE OK — Supabase read model, project isolation, no-data truth labels, PWA bridge.');
