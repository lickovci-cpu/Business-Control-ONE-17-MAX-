import assert from 'node:assert/strict';
import fs from 'node:fs';
import {merchInquiryFollowupPlan} from '../api/integrations/webhook.js';

const file=fs.readFileSync(new URL('../api/integrations/webhook.js',import.meta.url),'utf8');
const docs=fs.readFileSync(new URL('../docs/WEB_BCO_INTEGRATION.md',import.meta.url),'utf8');

for(const marker of [
  "BCO_INTEGRATION_SECRET",
  "next_action_at",
  "merchInquiryFollowupPlan",
  "scheduleMerchInquiryFollowup",
  "webhook_events",
  "PROJECT_NOT_INTEGRATION_ALLOWLIST",
  "lead.created",
  "order.created",
  "Authorization",
  "verified:true",
  "inquiry.created",
  "ensureLead",
  "INVALID_ORDER_ITEM_QUANTITY_",
  "INVALID_ORDER_ITEM_PRICE_", "releaseDedupe", "rowId"
])assert.ok(file.includes(marker),`integration marker missing: ${marker}`);
for(const marker of [
  "POST https://business-control-one.vercel.app/api/integrations/webhook",
  "mazliprint",
  "NOT VERIFIED",
  "Idempotency",
  "order.created"
])assert.ok(docs.includes(marker),`integration docs marker missing: ${marker}`);
console.log('WEB BCO INTEGRATION TEST OK');

const at=new Date('2026-10-06T12:00:00.000Z');
assert.equal(merchInquiryFollowupPlan({metadata:{request_type:'CUSTOM_MERCH',brief_score:10}},at).nextActionAt,'2026-10-06T14:00:00.000Z');
assert.equal(merchInquiryFollowupPlan({metadata:{request_type:'CUSTOM_MERCH',brief_score:8}},at).nextActionAt,'2026-10-06T18:00:00.000Z');
assert.equal(merchInquiryFollowupPlan({metadata:{request_type:'CUSTOM_MERCH',brief_score:5}},at).nextActionAt,'2026-10-07T12:00:00.000Z');
assert.equal(merchInquiryFollowupPlan({metadata:{request_type:'OTHER',brief_score:10}},at),null);
console.log('MERCH FOLLOWUP PLAN TEST OK');
