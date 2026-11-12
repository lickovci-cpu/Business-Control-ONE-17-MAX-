# Business Scout / Revenue Radar – prepared safe prompts

These are prepared for use after the BCO MCP bridge is configured. Existing jobs.json entries are intentionally left unchanged until the bridge and tokens are verified.

## Business Scout
Search for current, buyer-side B2B merch demand relevant to NŘŠM: DJs, clubs, crews, soundsystems, festivals, promoters and event organizers. Use no more than 3 focused searches and 2 exact-page extractions. Verify source page, observed date, buyer identity, request, quantity/specification, deadline and location. Do not treat suppliers, POD catalogues, retail prices or competitor offers as demand. For each verified prospect, call bco_ingest_verified_prospect with organization=ne-e-m, exact HTTPS source_url, observed_at, source_verified=true, company_name, source and available factual contact fields. If no buyer-side prospect survives, report NO DATA. Never create outreach drafts or send messages.

## Revenue Radar
Search current buyer-side opportunities for NŘŠM merch, then report Local Proof Factory prospects as research-only until its Supabase organization is provisioned. Use exact-page verification; reject expired, vague or supplier-side results. Ingest only NŘŠM prospects through bco_ingest_verified_prospect. Do not infer consent, legal basis, order value or revenue. Do not send emails, contact prospects, apply, buy access, or activate campaigns.

## Required output labels
VERIFIED / PARTIAL / UNVERIFIED / BLOCKED / NO DATA.
Report source URL and observed date for every stored prospect. A successful database insert is a research record, not an order, consent, or revenue.
