# BCO integration outbox — consumer status

Status: CONSUMER IMPLEMENTED AS AN ISOLATED, FEATURE-FLAGGED RELAY; SQL MIGRATION NOT APPLIED; NO SINK CONFIGURED.

## Existing durable queue design
- `docs/integration-outbox-schema-proposal.sql` remains a proposal only.
- It creates organization-scoped idempotency, atomic webhook-event + outbox insertion, `FOR UPDATE SKIP LOCKED` claim, fresh lock tokens, 10-minute lease reclaim, capped exponential retry, and dead-letter after bounded attempts.
- `tests/outbox-postgres.sql` and `tests/outbox-concurrency.sh` exercise the SQL design in isolated PostgreSQL CI. They do not run against hosted production Supabase.

## Consumer implementation
- `api/integrations/outbox-consumer.js` is a server-side relay; it requires `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `BCO_OUTBOX_SINK_URL`, and `BCO_OUTBOX_SINK_SECRET`.
- `BCO_INTEGRATION_OUTBOX_ENABLED` defaults to `false`. If disabled or incompletely configured, the handler does not claim rows.
- Claims use `claim_integration_outbox`; success/failure is recorded only with the current `lock_token` via `complete_integration_outbox` / `fail_integration_outbox`. Transient network/5xx/408/409/425/429 failures retry with backoff; permanent 4xx and invalid event shapes go directly to dead-letter.
- The downstream request receives `Idempotency-Key: <organization_id>:<dedupe_key>`. The sink must honor this key. Without downstream idempotency, delivery is at-least-once, not exactly-once.
- Invalid claimed records are sent through the failure RPC rather than being left in `processing` until lease expiry.
- The shared Cloudflare dispatcher can call this consumer as an optional fifth target only when `BCO_OUTBOX_CONSUMER_ENABLED=true`; it is off by default.
- Unit tests cover success, retry, dead-letter handling, stale completion, feature flags, missing sink configuration, and the idempotency header.

## Remaining integration gate
- `api/integrations/webhook.js` has NOT been switched to `enqueue_integration_event`; the SQL function is not present in hosted production.
- No concrete BCO event sink has been configured. The relay is transport-ready but does not itself apply CRM business changes.
- Before enabling: create/test a local Supabase migration, implement an idempotent event sink for each supported event type, test crash-after-side-effect behavior, confirm sink idempotency, and rehearse rollback.
- Do not set the feature flags or add production secrets until these gates pass.
