# BCO – inbound acquisition and first paid order

Status: staging preparation only. No posts have been published, no customer has been contacted, and no orders or payments are claimed.

## Current platform facts

- 1Social channels connected and active for NŘŠM: Facebook, Instagram, TikTok.
- 1Social plan: Solo; November 2026 quota 600 units, 600 remaining at last check.
- Facebook accepts text-only posts. Instagram and TikTok require media.
- BCO Cloudflare Worker currently exposes session and Revenue Engine only. Legacy `/api/ai`, `/api/comms`, `/api/meta`, `/api/upload` and other legacy routes still return HTTP 501. 1Social is therefore connected to the ChatGPT connector, not yet integrated into the BCO Worker.
- No public order form, payment gateway, or verified payment webhook is deployed in this staging phase.

## Canonical project IDs

- `nrsm`: NŘŠM (legacy UI key `merch`)
- `mazliprint`: MazliPrint
- `local-proof-factory`: Local Proof Factory
- `fve`: Jihočeské střechy / FVE (legacy UI key `jihoceske`)
- `unassigned`: not yet classified

Shared contacts are stored once. Project context belongs to leads/opportunities and downstream quotes, orders, jobs and financial entries.

## Offer and inbound form design

### NŘŠM – B2B merch

Audience: DJs, clubs, crews, soundsystems, festivals, promoters and event producers.

Inbound form fields:
- Organization / project name
- Contact name and one reply channel (email or phone)
- Event or intended use
- Product types and approximate quantity
- Sizes / variants if known
- Needed delivery date and city
- Existing artwork or a short brief
- Optional budget range

Process:
1. Save the inbound request as a lead with project_id `nrsm`.
2. Qualify quantity, product, deadline and artwork.
3. Confirm supplier cost, production lead time and delivery cost before quoting.
4. Send a written quote.
5. Require written approval and agreed deposit before production.
6. Convert to order only after acceptance; mark paid only after receipt is reconciled.

Draft inbound CTA:
“DJs, kluby, crews a pořadatelé: řešíte vlastní merch na akci nebo pro komunitu? NŘŠM připraví návrh a cenovou nabídku podle počtu kusů, typu textilu a termínu. Nejdřív si potvrdíme zadání a cenu, potom se řeší výroba. Napište nám: MERCH + počet kusů + termín akce. NŘŠM // BEZ ŘEČÍ. PO SVÝM.”

### MazliPrint – personalizovaný digitální portrét

Start with a digital deliverable to avoid inventory and production costs.

Inbound form fields:
- Reply email
- Pet photo upload
- Pet name (optional)
- Desired style / occasion
- Desired digital format
- Explicit consent to process the supplied photo for this order

Process:
1. Confirm image quality and exact deliverable.
2. Confirm a price only after time and delivery scope are set.
3. Collect payment before final high-resolution delivery.
4. Keep the supplied photo private; do not publish it without separate permission.
5. Offer physical goods only after supplier price, shipping and margin are verified.

### Local Proof Factory – local business presence audit

Target: trades and service businesses in Písek and South Bohemia.

Provisional offer: 2,490 CZK. This is not a confirmed fixed price until scope, delivery time and margin are checked.

Inbound form fields:
- Company / contact
- Website and public business profile URL
- City / service area
- Main service to promote
- Main issue or desired outcome
- Reply email or phone

Process:
1. Confirm the company and public information.
2. Prepare a short evidence-based audit, with no invented reviews, references or guarantees.
3. Confirm deliverables, time and price in writing.
4. Start only after customer approval; invoice and record actual payment separately.

## Shared CRM and revenue lifecycle

- One `contacts` record per real person/company where possible.
- One or more project-scoped `leads` and `opportunities`; never create a parallel CRM.
- Canonical project_id on leads, opportunities, quotes, merch orders, jobs and financial entries.
- Store non-relational form details in JSONB metadata; do not put secrets or unnecessary sensitive data there.
- Quote acceptance is not payment.
- Order creation is not payment.
- Only bank reconciliation or a verified payment-provider event may mark a financial entry as paid.
- Use an organization-scoped idempotency key for inbound webhooks and payment events.

## Public form security requirements

Before public forms are enabled:
- Use a same-origin Cloudflare Worker route; never expose the Supabase service-role key.
- Validate and normalize all fields server-side.
- Add Cloudflare Turnstile or equivalent bot protection and rate limiting.
- Use strict origin checks, request-size limits and honeypot/time-to-submit checks.
- Store only the minimum information needed to respond.
- Show a privacy notice and separate order-response consent from optional marketing consent.
- Do not send marketing messages to people who only submitted an order inquiry.
- Keep all writes tenant-scoped and log the source, timestamp and project_id.

## Social publishing guardrails

- The NŘŠM Facebook, Instagram and TikTok channels are active in 1Social.
- Instagram and TikTok require an image or video; Facebook currently accepts text-only.
- Every post must be previewed against network limits first.
- Do not publish without explicit approval of the exact copy and media.
- Keep all account tokens in 1Social; do not copy them into BCO frontend code.
- BCO Worker social integration is a later migration task; current 1Social connection is not evidence that BCO's legacy Meta endpoints are migrated.

## First-order priority

1. NŘŠM: first B2B merch inquiry, then written quote and deposit before production.
2. MazliPrint: first paid digital portrait, no physical production until supplier economics are verified.
3. Local Proof Factory: first inbound local audit request, then confirmed scope and 2,490 CZK provisional quote.

No lead, order, revenue or payment is counted until it exists and is verified in the staging CRM and supporting evidence.
