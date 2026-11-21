import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchCronJobs} from '../workers/bco-cron-dispatcher.js';

const env=()=>({CRON_SECRET:'test-cron-secret-long-enough',BCO_CRON_ORIGIN:'https://bco.example.test'});
const ok=async()=>new Response('{}',{status:200});

test('shared dispatcher preserves three five-minute jobs and six-hour UTC merch cadence',async()=>{
  const e=env(),calls=[];
  const fetcher=async(url,options)=>{calls.push({url:String(url),options});return ok();};
  let result=await dispatchCronJobs(Date.parse('2026-11-21T03:10:00Z'),e,fetcher);
  assert.equal(result.ok,true);assert.equal(calls.length,3);
  assert.deepEqual(calls.map(x=>new URL(x.url).pathname),['/api/cron','/api/automation-tick','/api/outbound-cron']);
  assert.ok(calls.every(x=>x.options.headers.Authorization==='Bearer test-cron-secret-long-enough'));
  calls.length=0;
  result=await dispatchCronJobs(Date.parse('2026-11-21T06:00:00Z'),e,fetcher);
  assert.equal(result.ok,true);assert.equal(calls.length,4);assert.equal(new URL(calls[3].url).pathname,'/api/merch-cron');
  calls.length=0;
  result=await dispatchCronJobs(Date.parse('2026-11-21T06:05:00Z'),e,fetcher);
  assert.equal(result.ok,true);assert.equal(calls.length,3,'merch route must not run outside the six-hour UTC boundary');
});

test('failed merch invocation is reported and not repeated on every five-minute tick',async()=>{
  const calls=[];
  const fetcher=async(url)=>{calls.push(new URL(url).pathname);return new Response('{}',{status:url.toString().endsWith('/api/merch-cron')?503:200});};
  const result=await dispatchCronJobs(Date.parse('2026-11-21T12:00:00Z'),env(),fetcher);
  assert.equal(result.ok,false);assert.equal(calls.filter(x=>x==='/api/merch-cron').length,1);
  calls.length=0;
  await dispatchCronJobs(Date.parse('2026-11-21T12:05:00Z'),env(),fetcher);
  assert.equal(calls.filter(x=>x==='/api/merch-cron').length,0);
});

test('dispatcher fails closed without secret or with an untrusted origin',async()=>{
  let calls=0;const fetcher=async()=>{calls++;return ok();};
  const missing=await dispatchCronJobs(Date.now(),{BCO_CRON_ORIGIN:'https://bco.example.test'},fetcher);
  assert.equal(missing.blocked,'CRON_SECRET_NOT_CONFIGURED');
  const invalid=await dispatchCronJobs(Date.now(),{CRON_SECRET:'x',BCO_CRON_ORIGIN:'http://localhost:3000'},fetcher);
  assert.equal(invalid.blocked,'BCO_CRON_ORIGIN_INVALID');assert.equal(calls,0);
});


test('four original Vercel schedules remain unchanged and no preview cron trigger is active',async()=>{
  const {readFile}=await import('node:fs/promises');
  const vercel=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
  const preview=await readFile(new URL('../wrangler.toml',import.meta.url),'utf8');
  const example=await readFile(new URL('../wrangler.cron-dispatcher.example.toml',import.meta.url),'utf8');
  const merch=await readFile(new URL('../api/merch-cron.js',import.meta.url),'utf8');
  assert.deepEqual(vercel.crons,[
    {path:'/api/merch-cron',schedule:'0 */6 * * *'},
    {path:'/api/cron',schedule:'*/5 * * * *'},
    {path:'/api/automation-tick',schedule:'*/5 * * * *'},
    {path:'/api/outbound-cron',schedule:'*/5 * * * *'}
  ]);
  assert.doesNotMatch(preview,/^\s*crons\s*=/im);
  assert.doesNotMatch(example,/^\s*crons\s*=/im);
  assert.match(merch,/MERCH_AUTO_PROSPECTING','false'/);
});


test('outbox consumer is an optional fifth dispatch target and remains off by default',async()=>{
  const calls=[],e=env();
  await dispatchCronJobs(Date.parse('2026-11-21T03:00:00Z'),e,async url=>{calls.push(new URL(url).pathname);return ok();});
  assert.equal(calls.includes('/api/integrations/outbox-consumer'),false);
  calls.length=0;e.BCO_OUTBOX_CONSUMER_ENABLED='true';
  await dispatchCronJobs(Date.parse('2026-11-21T03:00:00Z'),e,async url=>{calls.push(new URL(url).pathname);return ok();});
  assert.equal(calls.includes('/api/integrations/outbox-consumer'),true);
});
