# Hermes ↔ BCO bridge (prepared, not activated)

The local bridge is `scripts/hermes/bco-mcp.mjs`. It exposes only:
- `bco_list_verified_leads` (read-only)
- `bco_ingest_verified_prospect` (NŘŠM prospect ingestion only; no draft creation and no sending)

It deliberately exposes no email-send, policy-approval, or campaign activation tool.

## Hermes environment
Add these to `C:\Users\licko\AppData\Local\hermes\.env` only after creating the matching server secrets:
- `BCO_BASE_URL=https://business-control-one.vercel.app`
- `HERMES_BCO_READ_TOKEN=<random 32+ byte token>`
- `HERMES_BCO_WRITE_TOKEN=<different random 32+ byte token>`

Do not reuse CRON_SECRET, BCO_INTEGRATION_SECRET, APP_PASSWORD or any Supabase key.

## config.yaml MCP entry
Merge this under the existing `mcp_servers:` key in Hermes config; do not create a duplicate key:
```yaml
mcp_servers:
  bco:
    command: node
    args:
      - C:/Users/licko/Business-Control-ONE-17-MAX-/scripts/hermes/bco-mcp.mjs
    timeout: 30
```

The server inherits Hermes process environment. Restart Hermes gateway after the user has placed the tokens and the matching BCO environment variables are configured.

## BCO environment (server-side only)
- `HERMES_BCO_READ_TOKEN`
- `HERMES_BCO_WRITE_TOKEN`
- `HERMES_BCO_INGEST_ENABLED=false` until tested
- `OUTBOUND_AUTONOMY_ENABLED=false` until a campaign policy is separately approved
- `OUTLOOK_CLIENT_ID`
- `OUTLOOK_CLIENT_SECRET`
- `OUTLOOK_TENANT_ID` (or `common`)
- `OUTLOOK_REDIRECT_URI=https://business-control-one.vercel.app/api/integrations/outlook/callback`
- `OUTLOOK_STATE_SECRET`
- `OUTLOOK_TOKEN_ENCRYPTION_KEY` (base64-encoded 32-byte key)
- Existing `SUPABASE_URL` and `SUPABASE_SECRET_KEY`

Never put BCO secrets in Hermes prompts or MCP tool arguments.

## Prepared job prompts
Business Scout and Revenue Radar must:
1. Use web search/extract only to discover buyer-side evidence.
2. Reject suppliers, catalogues, competitor lists, expired posts, and inferred budgets.
3. Require exact HTTPS source URL, observed date, buyer/company identity, request scope and Czech/remote eligibility.
4. Call `bco_ingest_verified_prospect` only after verifying the exact item page; set `source_verified=true`.
5. Read back with `bco_list_verified_leads` to confirm deduplication.
6. Never send email, create outreach drafts, or mark consent granted. New public prospects are always `outreach_eligible=false` and `legal_basis=unknown`.

Local Proof Factory cannot be ingested yet: its organization slug/UUID has not been provisioned in Supabase. The endpoint intentionally refuses that organization until a proper organization mapping exists.
