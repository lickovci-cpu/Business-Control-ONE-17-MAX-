import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const sql=await readFile(new URL('../docs/bco-media-bucket-hardening-proposal.sql',import.meta.url),'utf8');
const localSql=await readFile(new URL('./storage-bucket-hardening-local.sql',import.meta.url),'utf8');
const runner=await readFile(new URL('./supabase-storage-auth.sh',import.meta.url),'utf8');

test('bucket hardening proposal requires both buckets to remain private',()=>{
  assert.match(sql,/id IN \('bco-media', 'job-media'\) AND public = false/);
  assert.match(sql,/EXPECTED_BOTH_PRIVATE_BCO_BUCKETS/);
});

test('both buckets are limited to the Worker 4 MiB boundary',()=>{
  assert.equal((sql.match(/SET file_size_limit = 4194304/g)||[]).length,2);
  assert.match(sql,/WHERE id = 'bco-media' AND public = false/);
  assert.match(sql,/WHERE id = 'job-media' AND public = false/);
  assert.match(sql,/BCO_BUCKET_HARDENING_FAILED/);
});

test('job-media allowlist remains limited to images and PDF',()=>{
  const jobBlock=sql.split("WHERE id = 'job-media'")[0].split("UPDATE storage.buckets").at(-1);
  assert.match(jobBlock,/image\/jpeg', 'image\/png', 'image\/webp', 'application\/pdf/);
  assert.doesNotMatch(jobBlock,/video\/mp4|video\/webm|video\/quicktime/);
});

test('local Supabase Auth/RLS integration applies and verifies the proposal before upload tests',()=>{
  assert.ok(runner.includes('bco-media-bucket-hardening-proposal.sql'));
  assert.ok(runner.includes('storage-bucket-hardening-local.sql'));
  assert.ok(runner.indexOf('bco-media-bucket-hardening-proposal.sql')<runner.indexOf('stage: create isolated Auth users'));
  assert.match(localSql,/LOCAL_BUCKET_SIZE_LIMITS_NOT_APPLIED/);
  assert.match(localSql,/LOCAL_BCO_MEDIA_MIME_ALLOWLIST_INVALID/);
  assert.match(localSql,/LOCAL_JOB_MEDIA_MIME_ALLOWLIST_INVALID/);
});

test('rollback documents the exact read-only observed settings and is not executed',()=>{
  assert.match(sql,/file_size_limit = 15728640/);
  assert.match(sql,/file_size_limit = NULL, allowed_mime_types = NULL/);
  assert.match(sql,/PROPOSAL ONLY/);
});
