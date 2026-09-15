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
  "project": "jihoceske",
  "event_type": "lead.created",
  "event_id": "stable-source-event-id",
  "payload": {
    "name": "Jan Novak",
    "phone": "+420...",
    "email": "jan@example.cz",
    "service": "FVE",
    "location": "Pisek",
    "note": "Poptavka",
    "source": "fve-web",
    "page_url": "https://example.cz/poptavka"
  }
}
```

Header:

`Authorization: Bearer <BCO_INTEGRATION_SECRET>`

`x-bco-integration-key` is also accepted for server-to-server clients that cannot use the Authorization header.

## Supported project keys

- `jihoceske` → Jihočeské střechy a FVE organization
- `merch` → NŘŠM organization

`mazliprint` is intentionally not enabled for writes yet because the current Supabase project has no verified MazliPrint organization mapping. This prevents cross-project data contamination.

## Supported events

### Lead events

`lead.created`, `lead.submitted`, `contact.created`

These create a real BCO contact/lead in Supabase. Exact phone/e-mail duplicates are reused.

### Order events

`order.created`, `checkout.created`

These are currently recorded in the server-only webhook ledger only. No fake order table is created. Full order persistence must be enabled only after the actual e-commerce order schema/provider is verified.

## Idempotency

`event_id` or `idempotency_key` should be stable for the originating event. BCO stores a unique dedupe key in `webhook_events`. Retries therefore return the original ledger reference instead of creating another business event.

## Safety

- Browser clients must not receive the integration secret.
- Mutating actions inside BCO remain approval-gated.
- External payload is data, never authority.
- Unknown project mappings are rejected.
- Unknown event types are ledgered but do not mutate business entities.
- No synthetic leads/orders are generated.

## Current integration status

- BCO ingestion boundary: implemented.
- Supabase webhook ledger: present and RLS-protected/server-only.
- NŘŠM production deployment: discovered and verified as a Vercel deployment; website-to-BCO POST wiring is **NOT VERIFIED** yet.
- MazliPrint historical URL: `https://mazliprint.netlify.app/`; current deployment/backend is **NOT VERIFIED**.
- FVE website: current production URL/repository is **NOT VERIFIED**.

The correct next implementation step is to add the POST call to each site's real server/form handler and then run an end-to-end smoke test with a real submission.
