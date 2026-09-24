import assert from 'node:assert/strict';
import fs from 'node:fs';

const file=fs.readFileSync(new URL('../api/integrations/webhook.js',import.meta.url),'utf8');
const docs=fs.readFileSync(new URL('../docs/WEB_BCO_INTEGRATION.md',import.meta.url),'utf8');

for(const marker of [
  "BCO_INTEGRATION_SECRET",
  "webhook_events",
  "PROJECT_NOT_INTEGRATION_ALLOWLIST",
  "lead.created",
  "order.created",
  "Authorization",
  "verified:true",
  "inquiry.created",
  "ensureLead",
  "INVALID_ORDER_ITEM_QUANTITY_",
  "INVALID_ORDER_ITEM_PRICE_"
])assert.ok(file.includes(marker),`integration marker missing: ${marker}`);
for(const marker of [
  "POST https://business-control-one.vercel.app/api/integrations/webhook",
  "mazliprint",
  "NOT VERIFIED",
  "Idempotency",
  "order.created"
])assert.ok(docs.includes(marker),`integration docs marker missing: ${marker}`);
console.log('WEB BCO INTEGRATION TEST OK');
