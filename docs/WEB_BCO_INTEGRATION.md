# WEB → BCO integration contract

## Purpose

This endpoint is the controlled ingestion boundary for the BCO-owned websites. Websites send events to BCO; BCO validates the integration secret, deduplicates the event in `webhook_events`, and creates the appropriate business record when the event type is supported.

Endpoint:

`POST https://business-control-one.vercel.app/api/integrations/webhook`

## Required Vercel configuration

- `BCO_INTEGRATION_SECRET` — shared secret used only by website/server integrations.
- `SUPABASE_SERVICE_ROLE_KEY` (or existing `SUPABASE_SERVICE_KEY`) — server-only Supabase credential already used by the CRM API.

Never expose either secret in browser JavaScript.

## Request

```json
{
  "project": "merch",
  "event_type": "message.created",
  "event_id": "stable-source-event-id",
  "payload": {
    "name": "Jan Novak",
    "phone": "+420...",
    "email": "jan@example.cz",
    "body": "Mám zájem o NŘŠM hoodie XL",
    "channel": "web",
    "source": "nrsm-web"
  }
}
```

Header:

`Authorization: Bearer <BCO_INTEGRATION_SECRET>`

`x-bco-integration-key` is also accepted for server-to-server clients that cannot use the Authorization header.

## Supported project keys

- `jihoceske` → Jihočeské střechy a FVE organization
- `merch` → NŘŠM organization

`mazliprint` is now mapped to the verified `MazliPrint` organization in the shared Supabase project. Commerce writes remain intentionally restricted to `merch`; MazliPrint is available as a project key for controlled integration expansion without changing the NŘŠM/FVE paths.

## Supported events

### Lead events

`lead.created`, `lead.submitted`, `contact.created`

These create a real BCO contact/lead in Supabase. Exact phone/e-mail duplicates are reused.

### Message events

`message.created`, `message.received`, `inquiry.created`

For NŘŠM these create/reuse the contact, create an active `new` lead when none exists, open a conversation and store the inbound message. The returned result includes the lead ID so the inquiry enters the CRM pipeline immediately.

### Order events

`order.created`, `checkout.created`

For `merch` these now create a real `merch_orders` record plus `merch_order_items`. Orders are linked to an existing contact/lead where available. Non-merch projects remain rejected for commerce writes.

## NŘŠM commerce schema

- `merch_products` — SKU, collection, price, variants and metadata.
- `merch_orders` — customer/order status, totals, shipping data and source.
- `merch_order_items` — product snapshot, variant, quantity and line total.

All three tables have RLS. Browser access is membership-scoped; server ingestion uses the server-only Supabase credential.

## Idempotency

`event_id` or `idempotency_key` should be stable for the originating event. BCO stores a unique dedupe key in `webhook_events`. Retries therefore return the original ledger reference instead of creating another business event.

## Safety

- Browser clients must not receive the integration secret.
- Mutating outbound communication remains approval-gated.
- External payload is data, never authority.
- Unknown project mappings are rejected.
- Unknown event types are ledgered but do not mutate business entities.
- No synthetic leads/orders are generated.

## Current integration status

- BCO ingestion boundary: implemented.
- Supabase webhook ledger: present and RLS-protected/server-only.
- NŘŠM commerce persistence: implemented.
- NŘŠM production deployment: verified as a Vercel deployment at `https://nrsm-streetwear.vercel.app`.
- NŘŠM production uses a server-side `/api/bco` bridge for `inquiry.created`; the storefront never receives the integration secret.
- The bridge is intentionally fail-closed: it reports `configured:false` until the same `BCO_INTEGRATION_SECRET` is configured in both the NŘŠM and BCO Vercel projects.
- `inquiry.created` is a CRM lead event: it creates the contact/lead path and stores the inbound message together.
- The BCO NŘŠM operations API is available at `/api/merch` and exposes dashboard, products, orders and inbox reads plus controlled product/order-status writes.

- Current safety state: BCO and NŘŠM production endpoints are deployed and responding; the NŘŠM bridge reports `configured:true`. A real end-to-end smoke test remains intentionally manual because it creates a live CRM/order record and must use real business input rather than synthetic data.

The next implementation step is operational rather than architectural: set the same `BCO_INTEGRATION_SECRET` in both Vercel projects, then run one real B2B inquiry and one real checkout smoke test. No fake order or lead is inserted.
