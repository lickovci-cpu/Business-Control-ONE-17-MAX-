\set ON_ERROR_STOP on
DO $$
DECLARE
  event_a uuid;
  event_a_duplicate uuid;
  event_b uuid;
  claimed_id uuid;
  token_1 uuid;
  token_2 uuid;
  token_3 uuid;
  result_status text;
  row_status text;
  row_attempts integer;
  n integer;
BEGIN
  SELECT event_id INTO event_a
  FROM public.enqueue_integration_event(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','stripe','invoice.paid','evt_same','{"amount":100}'::jsonb
  );
  SELECT event_id INTO event_a_duplicate
  FROM public.enqueue_integration_event(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','stripe','invoice.paid','evt_same','{"amount":100}'::jsonb
  );
  IF event_a IS NULL OR event_a_duplicate IS DISTINCT FROM event_a THEN
    RAISE EXCEPTION 'IDEMPOTENCY_SAME_ORG_FAILED';
  END IF;

  SELECT event_id INTO event_b
  FROM public.enqueue_integration_event(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','stripe','invoice.paid','evt_same','{"amount":100}'::jsonb
  );
  IF event_b IS NULL OR event_b = event_a THEN
    RAISE EXCEPTION 'IDEMPOTENCY_CROSS_ORG_ISOLATION_FAILED';
  END IF;

  SELECT count(*) INTO n FROM public.integration_outbox
  WHERE organization_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  IF n <> 1 THEN RAISE EXCEPTION 'DUPLICATE_OUTBOX_ROWS: %', n; END IF;

  SELECT id, lock_token INTO claimed_id, token_1
  FROM public.claim_integration_outbox(1);
  IF claimed_id IS NULL OR token_1 IS NULL THEN RAISE EXCEPTION 'CLAIM_FAILED'; END IF;

  IF public.complete_integration_outbox(claimed_id, gen_random_uuid()) THEN
    RAISE EXCEPTION 'STALE_TOKEN_COMPLETED';
  END IF;

  UPDATE public.integration_outbox
  SET locked_at = clock_timestamp() - interval '11 minutes'
  WHERE id=claimed_id;
  SELECT id, lock_token INTO claimed_id, token_2
  FROM public.claim_integration_outbox(1);
  IF token_2 IS NULL OR token_2 = token_1 THEN
    RAISE EXCEPTION 'EXPIRED_LEASE_NOT_RECLAIMED';
  END IF;
  IF public.complete_integration_outbox(claimed_id, token_1) THEN
    RAISE EXCEPTION 'OLD_LEASE_TOKEN_ACCEPTED';
  END IF;

  result_status := public.fail_integration_outbox(claimed_id, token_2, 'temporary failure');
  IF result_status <> 'retry' THEN
    RAISE EXCEPTION 'RETRY_STATE_WRONG: %', result_status;
  END IF;
  UPDATE public.integration_outbox
  SET available_at = clock_timestamp() - interval '1 second'
  WHERE id=claimed_id;
  SELECT id, lock_token INTO claimed_id, token_3
  FROM public.claim_integration_outbox(1);
  IF token_3 IS NULL OR token_3 = token_2 THEN
    RAISE EXCEPTION 'RETRY_NOT_RECLAIMED';
  END IF;
  IF NOT public.complete_integration_outbox(claimed_id, token_3) THEN
    RAISE EXCEPTION 'VALID_LEASE_COMPLETION_FAILED';
  END IF;

  SELECT id, lock_token INTO claimed_id, token_1
  FROM public.claim_integration_outbox(1);
  IF claimed_id IS NULL THEN RAISE EXCEPTION 'SECOND_ORG_CLAIM_FAILED'; END IF;
  UPDATE public.integration_outbox
  SET attempts = max_attempts, locked_at = clock_timestamp() - interval '11 minutes'
  WHERE id=claimed_id;
  PERFORM * FROM public.claim_integration_outbox(1);
  SELECT status, attempts INTO row_status, row_attempts
  FROM public.integration_outbox WHERE id=claimed_id;
  IF row_status <> 'dead' OR row_attempts < 1 THEN
    RAISE EXCEPTION 'EXPIRED_FINAL_LEASE_NOT_DEAD';
  END IF;

  BEGIN
    PERFORM * FROM public.claim_integration_outbox(0);
    RAISE EXCEPTION 'INVALID_BATCH_SIZE_NOT_REJECTED';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'INVALID_BATCH_SIZE' THEN RAISE; END IF;
  END;

  IF has_function_privilege('anon','public.claim_integration_outbox(integer)','EXECUTE') THEN
    RAISE EXCEPTION 'ANON_CAN_CLAIM_OUTBOX';
  END IF;
  IF has_function_privilege('authenticated','public.claim_integration_outbox(integer)','EXECUTE') THEN
    RAISE EXCEPTION 'AUTHENTICATED_CAN_CLAIM_OUTBOX';
  END IF;
  IF NOT has_function_privilege('service_role','public.claim_integration_outbox(integer)','EXECUTE') THEN
    RAISE EXCEPTION 'SERVICE_ROLE_CANNOT_CLAIM_OUTBOX';
  END IF;
END $$;

CREATE FUNCTION public.test_reject_outbox_insert() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'FORCED_OUTBOX_FAILURE'; END $$;
CREATE TRIGGER test_reject_outbox_insert
BEFORE INSERT ON public.integration_outbox
FOR EACH ROW EXECUTE FUNCTION public.test_reject_outbox_insert();
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.enqueue_integration_event(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','test','atomic','atomic_rollback','{"test":true}'::jsonb
    );
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'FORCED_OUTBOX_FAILURE' THEN RAISE; END IF;
  END;
END $$;
DROP TRIGGER test_reject_outbox_insert ON public.integration_outbox;
DROP FUNCTION public.test_reject_outbox_insert();
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.webhook_events
  WHERE dedupe_key='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:test:atomic_rollback';
  IF n <> 0 THEN RAISE EXCEPTION 'INGRESS_NOT_ATOMIC'; END IF;
END $$;

SELECT event_id FROM public.enqueue_integration_event(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','test','concurrency','concurrency_1','{"n":1}'::jsonb
);
SELECT event_id FROM public.enqueue_integration_event(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','test','concurrency','concurrency_2','{"n":2}'::jsonb
);
