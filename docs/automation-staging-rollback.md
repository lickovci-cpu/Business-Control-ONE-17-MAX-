# BCO scheduler migration — staging and rollback runbook

Status: PREPARATION ONLY. The migration `20261121_bco_automation_claims.sql` has not been applied to production. Do not run this document against the production project.

## Staging prerequisite

1. Create an isolated Supabase staging branch/database from the current production schema using Supabase branching or an equivalent isolated project. Confirm the target project/branch ID before any SQL.
2. Take and verify a restorable backup/snapshot. Record the current migration list, schema definition for `automations` and `automation_runs`, row counts, RLS state, grants, and function definitions.
3. Use synthetic test organizations and synthetic scheduled automations only. Disable any external integration credentials in staging. Never use a production service-role key in a browser or test fixture.
4. Confirm the staging branch has the same relevant table columns and constraints as production before applying the migration.

## Apply in staging

1. Apply `20261121_bco_automation_claims.sql` only to the isolated staging database.
2. Confirm the new scheduler columns exist and have the intended types/defaults.
3. Confirm the partial unique index on `automation_runs.idempotency_key` exists.
4. Confirm both RPCs are `SECURITY DEFINER` with fixed `search_path`, reject callers whose JWT role is not `service_role`, revoke execute from `PUBLIC`, `anon`, and `authenticated`, and grant execute only to `service_role`.
5. Run 20 concurrent claim calls for the same slot against one synthetic due automation. Exactly one caller may claim it. Then run 20 concurrent calls against 20 synthetic due automations; all returned run IDs and automation IDs must be unique, and no duplicate idempotency key may be created.
6. Test a running row with an expired lease. It must be settled as failed and have its lease cleared; a later eligible slot must be claimable.
7. Test a non-expired lease. A second claimant must skip it.
8. Test idempotency by repeating the same slot. It must not create a second run.
9. Test retry delays with deterministic attempts: 5 minutes, 15 minutes, then 60 minutes (capped). Confirm `next_retry_at` prevents early re-claim and that a due retry bypasses the normal interval gate.
10. Test `finish_bco_automation_run` for success, failure, wrong run ID, wrong automation ID, and non-running rows.
11. Run the repository CI test suite and Supabase advisors against staging. Inspect logs for SQL errors and verify no external calls were made.

## Rollback rehearsal (staging only)

Run only after recording the exact pre-migration state and confirming no staging worker depends on the new columns:

```sql
begin;

drop function if exists public.finish_bco_automation_run(uuid, uuid, boolean, jsonb, text, timestamptz);
drop function if exists public.claim_bco_automation_runs(timestamptz, integer);

drop index if exists public.automation_runs_idempotency_key_uidx;
drop index if exists public.automations_due_scheduler_idx;

alter table public.automation_runs
  drop column if exists schedule_slot,
  drop column if exists idempotency_key,
  drop column if exists lease_expires_at,
  drop column if exists attempt_count;

alter table public.automations
  drop column if exists last_attempt_at,
  drop column if exists next_retry_at,
  drop column if exists attempt_count,
  drop column if exists lease_expires_at,
  drop column if exists last_error;

rollback;
```

The rehearsal above deliberately ends with `ROLLBACK`, so it validates the SQL transaction without persisting the rollback. For an actual staging rollback, replace the final `ROLLBACK` with `COMMIT` only after explicit review and after confirming the staging database is the selected target. Never run an actual rollback on production as part of this preparation.

## Production gate

Production remains BLOCKED until: a restorable backup is verified; the full staging concurrency/lease/idempotency/backoff test passes; Supabase advisors are clean; the executor and provider secret are ready; Cloudflare bindings/secrets are configured; and a documented rollback owner and window are agreed. This runbook does not authorize production application or deployment.
