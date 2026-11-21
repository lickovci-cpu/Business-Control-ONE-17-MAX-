# BCO × 1Social — controlled publishing bridge

## Current verified state (21 Nov 2026)

- 1Social is the only connected publisher. Do not add Metricool or Publora as a duplicate.
- Connected channels: Facebook NŘŠM MERCH, Instagram nrsm.merch, TikTok user7003426715763.
- All three channels report active. The TikTok handle is generic and must be confirmed by the account owner before any post is sent there.
- Solo plan: 600 monthly units; 0 used; 600 remaining.
- 1Social post list: 0 posts.
- BCO content_items: 40 rows (8 published, 32 drafts); all 40 have empty asset_ids.
- BCO media_assets: 0 rows.
- content_items already has asset_ids, metadata, published_at, and external_url; no second publishing table is needed.
- No 1Social API credential or server-side API contract is registered in BCO. The ChatGPT 1Social connector is not a Worker credential. Do not call undocumented endpoints from Cloudflare.

## Safe workflow

1. Select one existing content_items draft and verify its organization.
2. Create/approve the actual image or video. Store it in Supabase Storage and register it in media_assets; link its ID in content_items.asset_ids.
3. Instagram and TikTok require media. Facebook can accept text-only, but use approved brand assets where possible.
4. Run 1Social preview_post for the exact channels and media. Resolve all warnings before publishing.
5. Publish only with a stable idempotency key derived from the content item and intended channel set. Never retry an unknown delivery without the user's confirmation; it could duplicate a live post.
6. Read the provider receipt with list_posts. Record per-network delivered, failed, cancelled, or unknown exactly as returned.
7. Reconcile the receipt into the existing content_items.metadata JSONB field. Do not mark a content item published until every selected channel is confirmed delivered. Partial and unknown states stay explicit.

## Receipt shape (metadata only; no new table)

metadata.social_delivery should contain:
- provider: 1social
- provider_post_id
- idempotency_key
- status: scheduled, published, partial, failed, cancelled, or unknown
- submitted_at, published_at
- deliveries: one object per platform with platform, channel_id, status, delivery_id, external_url, error, and checked_at

Only store provider-returned IDs, URLs, timestamps, and statuses. Never infer a delivery from a successful publish request. If a delivery is unknown, the user must inspect the network and confirm it.

## Blockers

- There are no media assets in BCO yet; the 40 content items are not production-ready for media-required channels.
- The TikTok account identity needs confirmation.
- Direct Worker-to-1Social publishing is blocked until 1Social provides a documented server API and a dedicated secret. Until then, publishing remains through the connected 1Social connector and BCO receipt reconciliation.
