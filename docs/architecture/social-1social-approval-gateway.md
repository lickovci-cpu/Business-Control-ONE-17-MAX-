# BCO × 1Social — approval-gated integration design

**Status:** DESIGN ONLY — not implemented, not deployed, no external publishing enabled  
**Prepared:** 2026-11-21  
**Base:** `bco/control-plane-v1`  
**Design branch:** `bco/social-1social-approval-design`

## 1. Non-negotiable operating rules

1. Supabase BCO remains the sole business source of truth.
2. Reuse `public.content_items`, `public.ai_approvals`, and the existing NŘŠM Content Agent. Do not add a second CRM, content table, queue table, or integration ledger.
3. Every external write requires an explicit, single-use approval for the exact payload and target account.
4. A change to text, media, platform, account, or scheduled timestamp invalidates the approval.
5. No autonomous publishing, scheduled dispatch, background retries, or recurring publishing job.
6. Store provider receipts, public URLs, and redacted failures on the same `content_items` row.
7. Treat uncertain provider outcomes as `unknown`; never retry blindly.
8. Prioritize qualified inbound leads, quote requests, and paid orders over reach, impressions, or likes.

## 2. Verified current state (live inspection)

### Supabase schema

The live project contains:

- `content_items`: `id`, `organization_id`, `title`, `content_type`, `platform`, `status`, `body`, `asset_ids`, `tags`, `scheduled_at`, `published_at`, `external_url`, `metadata`, timestamps.
- `ai_approvals`: `id`, `organization_id`, `agent_id`, `action_type`, `entity_type`, `entity_id`, `payload`, `status`, request/resolution/execution timestamps, resolver and note.
- `ai_agents`: includes the NŘŠM Content Agent, whose autonomy is `approval` and allowed actions are draft-only (`draft_post`, `draft_story`, `draft_reel`).

Existing RLS policies on these three tables scope access through `private.org_role(organization_id)`; approval and content writes are restricted to owner/admin/manager roles. Do not weaken these policies.

There is no dedicated social-integration table and no approval payload-hash column. Keep the hash and delivery metadata inside existing JSONB fields initially. If a database-level uniqueness guarantee is required, add only a narrowly scoped migration after tests; do not create another table.

### Existing BCO control plane

The repository already has signed confirmation tokens, canonical payload fingerprinting, approval consumption, task state transitions, evidence requirements, audit records, and a KV-backed atomic `SET NX EX` attempt lock in `api/_confirm.js`, `api/_control.js`, and `api/_lib.js`.

These are useful existing patterns, not a reason to bypass Supabase approvals. Supabase `ai_approvals` remains the durable business approval record. KV may be used only as a short-lived concurrency lock / operational cache; it must not become a second source of truth.

The existing Meta photo endpoint validates a waiting-approval task, project binding, payload hash, and media manifest. Reuse the security principles, but do not route 1Social through Meta Graph endpoints.

### Current 1Social readiness

The connected 1Social workspace previously showed NŘŠM Facebook, Instagram, and TikTok accounts. This proves the ChatGPT-side connection only. It does **not** prove that BCO's server has an authenticated remote-MCP OAuth client. Server-to-server OAuth/MCP support is still a prerequisite.

## 3. Proposed data contract (reuse existing rows)

### `content_items.metadata.social`

Keep the existing columns and use a namespaced JSON object:

```json
{
  "social": {
    "schema_version": 1,
    "approval": {
      "approval_id": "uuid",
      "payload_hash": "sha256-hex",
      "approved_at": "ISO-8601",
      "approved_by": "auth-user-uuid",
      "state": "approved"
    },
    "target": {
      "provider": "1social",
      "platform": "facebook|instagram|tiktok",
      "account_id": "provider-account-id"
    },
    "dispatch": {
      "state": "not_sent|claimed|sent|published|failed|unknown",
      "idempotency_key": "sha256-hex",
      "attempt_id": "uuid",
      "claimed_at": "ISO-8601",
      "provider_post_id": null,
      "permalink": null,
      "published_at": null,
      "last_error_code": null,
      "last_error_safe": null
    }
  }
}
```

The object above is a proposed shape, not a live record. Preserve unrelated metadata keys during all writes. Never store OAuth access/refresh tokens, secret keys, raw request headers, or full provider error payloads in this JSON.

### `ai_approvals.payload`

For `action_type = social:publish`, store an immutable approval snapshot:

- `content_item_id`
- `content_version` (monotonic application revision; if no existing revision column is added, use a canonical content snapshot hash)
- `payload_hash`
- `provider = 1social`
- `platform`
- `provider_account_id`
- `asset_ids` plus verified asset SHA-256 values
- `scheduled_at` (must be null for this first manual-dispatch release)
- `requested_by`
- `schema_version`

The `entity_type` should identify the existing content item and `entity_id` should equal its UUID. The `organization_id` must match the content item's organization. `agent_id` must be the existing NŘŠM Content Agent ID.

Do not assume new values are accepted by any status CHECK constraint. Inspect the live constraints before changing status values. Keep `content_items.status = draft` until the existing application status contract is verified; use metadata for new social workflow state in the first iteration.

## 4. Canonical payload hash

Compute SHA-256 over a deterministic canonical JSON object containing exactly:

- content item ID and organization ID
- title and body (exact UTF-8 strings)
- content type and platform
- ordered tags
- ordered asset IDs and their verified content hashes
- provider name, provider account ID, and platform
- scheduled timestamp (null in v1)
- schema version

Rules:

1. Sort object keys recursively; preserve array order.
2. Do not include mutable display-only UI fields.
3. Normalize timestamps to UTC ISO-8601 before hashing.
4. Re-read the content row and media assets immediately before approval and again before dispatch.
5. Recompute the hash at dispatch. If it differs from the approval payload hash, mark the approval stale/expired and stop.
6. Any edit after approval requires a new `ai_approvals` row. Never silently transfer approval to a changed draft.

## 5. Approval and manual dispatch state machine

```text
draft (content_items)
  -> pending approval (ai_approvals.status = pending)
  -> approved (single exact payload hash)
  -> claimed (atomic one-time dispatch claim)
  -> sent (provider accepted request)
  -> published (verified provider receipt + public permalink)

Alternative terminal / hold states:
  rejected | expired | failed | unknown
```

- Drafting is allowed for the NŘŠM Content Agent.
- Requesting approval creates one `ai_approvals` row and links its ID/hash to the same `content_items` metadata.
- Only a human owner/admin/manager may approve.
- Approval is single-use, short-lived, organization-bound, content-bound, account-bound, and hash-bound.
- A separate, explicit human action starts the dispatch. Approval alone does not schedule or automatically publish.
- v1 does not accept future `scheduled_at` values; it is immediate manual dispatch only.
- No cron worker may claim or publish social content.

## 6. Idempotency and uncertain outcomes

Use a deterministic key such as:

```text
sha256("1social" + organization_id + content_item_id + approval_id + payload_hash)
```

Before making the external call:

1. Atomically claim the exact content item / approval pair.
2. Reject if the approval was consumed, the hash changed, the row is already published, or a prior attempt is `claimed`, `sent`, or `unknown`.
3. Persist `claimed` and an attempt ID to the same `content_items.metadata.social.dispatch` object before network I/O.
4. Use provider-side idempotency only if 1Social explicitly documents and exposes it. Do not assume MCP calls accept an idempotency header.
5. On a confirmed provider success, persist provider post ID, permalink, and published timestamp.
6. On a definite provider rejection, persist a sanitized error code/message and mark `failed`.
7. On timeout, disconnect, or ambiguous response, mark `unknown`, reconcile with 1Social receipts/listing, and require a human decision before another attempt.

**Exactly-once delivery cannot be promised** unless the provider supports idempotency or a reliable receipt lookup. The safe fallback is at-most-once dispatch plus manual reconciliation, not automatic retry.

For concurrency, prefer a conditional database update / narrowly scoped SQL RPC with row locking and a unique constraint on the existing approval/idempotency identity. Before writing that migration, inspect current constraints and prove the function is safe under the existing RLS model. A KV `SET NX EX` lock may be an additional short-lived guard but is not durable evidence of publication.

## 7. Server-side 1Social adapter

Create a server-only adapter behind the existing BCO API/control plane:

- OAuth authorization and refresh handled only server-side.
- Store OAuth credentials in a managed server secret store / encrypted server environment, never in browser bundles, Git, or `content_items.metadata`.
- Scope the connection to the exact provider accounts and organization.
- Adapter operations in v1: account listing, media preflight/upload if required, preview, one explicit publish call, and receipt lookup.
- Reject unknown provider accounts and unsupported media/platform combinations.
- Do not implement provider scheduling, background publishing, or automatic retries.
- Redact bearer tokens and private provider payloads from logs.

The currently connected ChatGPT 1Social MCP session is not itself a server-side credential for BCO. Do not copy its session token or attempt to scrape it. If 1Social does not provide a supported remote MCP OAuth flow usable by BCO, stop and keep the approval-to-publish step operator-mediated through ChatGPT until a supported integration path exists.

## 8. Delivery receipt and error contract

Write to the same `content_items` row:

- `status`: update to `published` only after a confirmed provider receipt and after checking the existing allowed status values.
- `published_at`: provider timestamp, normalized to UTC.
- `external_url`: public permalink returned by the provider.
- `metadata.social.dispatch`: provider, account ID, provider post ID, attempt ID, idempotency key, outcome, verified timestamp, sanitized error code/message.
- `metadata.social.approval`: approval ID, payload hash, approver and timestamp.

Do not mark a post as published from a preview response, accepted-but-unconfirmed request, local queue status, or a guessed permalink.

## 9. Tests required before any production release

### Unit tests
- canonical hash stable across object key ordering
- text, tags, account, platform, asset hash, or timestamp change alters hash
- stale approval is rejected
- expired approval is rejected
- wrong organization/account is rejected
- approval replay is rejected
- missing/invalid media blocks dispatch

### Integration / concurrency tests
- two simultaneous dispatch attempts: exactly one claim wins
- provider success persists receipt exactly once
- provider 4xx persists a safe failure
- timeout after provider acceptance becomes `unknown`, never auto-retries
- receipt reconciliation updates the original content item
- RLS blocks cross-organization access
- duplicate webhook/receipt does not duplicate or overwrite another post

### Regression / operational checks
- existing Meta, email, RCS and CEO automations still pass their current test suites
- `npm test` and `npm run check` pass
- Supabase security and performance advisors reviewed
- logs contain no credentials or unredacted provider payloads

## 10. Commercial measurement

Every content item must have one measurable commercial intent:

- B2B merch: request for product, quantity, deadline, and contact.
- MazliPrint: request for pet photo/product, selected item, and contact.
- Local Proof Factory: request for a local business website/profile audit or a qualified call.

Track conversions in the existing CRM using source/content references where supported. Report separately:

- qualified inbound leads
- quotes sent
- orders confirmed
- payments received

Reach, views, likes, and follows are diagnostic only; they are not revenue.

## 11. Delivery plan / gates

| Phase | Work | Exit condition |
|---|---|---|
| 0 — Design | This document; schema and source audit | Design reviewed |
| 1 — Read-only adapter | OAuth capability proof, list accounts, preview only | No external writes possible |
| 2 — Approval binding | Persist approval snapshot/hash using existing tables | Stale/replay tests pass |
| 3 — Manual dispatch | Single explicit send action, atomic claim, receipt writeback | Concurrency and timeout tests pass |
| 4 — Pilot | One NŘŠM Facebook post after explicit user approval | Receipt verified in BCO |
| 5 — Expand | Instagram/TikTok after media and account tests; other brands only after their own accounts/org mapping are verified | Per-platform acceptance |

No phase is automatically authorized by the previous phase. Production deployment requires a fresh backup, test evidence, rollback plan, and explicit user approval.

## 12. Known blockers / open questions

1. BCO server-side 1Social OAuth/MCP client is not currently verified.
2. 1Social provider-side idempotency support is not verified; do not assume it.
3. Confirm which connected account IDs map to each BCO organization before any dispatch.
4. The live database has no dedicated Local Proof Factory organization; do not assign its content to NŘŠM or FVE by assumption.
5. The live schema has no explicit payload-hash column in `ai_approvals`; v1 stores the snapshot/hash in `payload`. A migration is optional only if tests prove JSONB storage insufficient.
6. The live approval table currently has zero rows; no social approval workflow is active yet.

## 13. Rollback

This design-only commit changes no production code, database schema, credentials, deployment, or external account state.

For later implementation:
- feature-flag the adapter off by default;
- disable dispatch endpoint / remove the server-side provider secret to stop new sends;
- leave existing delivery receipts intact;
- do not delete `content_items` or `ai_approvals`;
- revert the isolated code commit if needed;
- restore database only from a verified pre-migration backup if a schema migration was applied.

