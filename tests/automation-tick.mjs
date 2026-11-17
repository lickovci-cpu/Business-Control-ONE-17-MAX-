import assert from 'node:assert/strict';
import {intervalMs,isDue,projectForOrgSlug,lockKeyForTick,JOB_SUMMARY_SELECT,FINANCIAL_ENTRY_SUMMARY_SELECT} from '../api/automation-tick.js';

const t0=new Date('2026-09-25T10:00:00Z');
assert.equal(lockKeyForTick(t0),lockKeyForTick(new Date('2026-09-25T10:04:59Z')));
assert.notEqual(lockKeyForTick(t0),lockKeyForTick(new Date('2026-09-25T10:05:00Z')));

assert.equal(intervalMs({schedule:'every_6_hours'}),21600000);
assert.equal(intervalMs({interval_hours:24}),86400000);
assert.equal(intervalMs({interval_minutes:5}),300000);
assert.equal(intervalMs({interval_minutes:0}),null);

const base={active:true,trigger_config:{interval_minutes:5}};
assert.equal(isDue({...base,last_run_at:null},new Date('2026-09-25T10:00:00Z')),true);
assert.equal(isDue({...base,last_run_at:'2026-09-25T09:56:00Z'},new Date('2026-09-25T10:00:00Z')),false);
assert.equal(isDue({...base,last_run_at:'2026-09-25T09:55:00Z'},new Date('2026-09-25T10:00:00Z')),true);
assert.equal(isDue({...base,active:false,last_run_at:null},new Date('2026-09-25T10:00:00Z')),false);

assert.equal(projectForOrgSlug('fve'),'jihoceske');
assert.equal(projectForOrgSlug('ne-e-m'),'merch');
assert.equal(projectForOrgSlug('mazliprint'),'mazliprint');
assert.equal(projectForOrgSlug('unknown'),null);

assert.equal(JOB_SUMMARY_SELECT,'id,status,scheduled_at');
assert.equal(FINANCIAL_ENTRY_SUMMARY_SELECT,'id,amount,occurred_on,entry_type,status');
assert.ok(!JOB_SUMMARY_SELECT.includes('scheduled_for'));
assert.ok(!FINANCIAL_ENTRY_SUMMARY_SELECT.includes('date,type'));

console.log('AUTOMATION SCHEDULER CORE OK');
