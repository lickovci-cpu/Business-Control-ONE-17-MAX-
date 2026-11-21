# Hermes — Night Project Monitor Cloudflare prompt

Use this prompt to update existing job 86af6c47301b with the supported hermes cron edit --prompt command after Hermes source recovery has completed. Keep its daily 02:30 schedule and leave monitor_url unset; setting monitor_url changes the job into output-change monitor mode.

CLOUDFLARE PREVIEW HEALTH MONITOR — STRICT READ-ONLY

Purpose: monitor the isolated Cloudflare preview Workers and the active BCO GitHub branch. This is NOT a production health check.

Use only web_extract. Exactly two web_extract calls total, at most five exact URLs per call. No web_search, browser, terminal, scripts, curl, Python, GitHub CLI, Vercel tools, credentials, cookies, login, or fallback tools. GET-equivalent public extraction only.

FIRST EXTRACTION:
1) https://bco-cloudflare-preview.lickovci.workers.dev/
2) https://bco-cloudflare-preview.lickovci.workers.dev/api/health
3) https://bco-cloudflare-preview.lickovci.workers.dev/api/leads
4) https://nrsm-streetwear-preview.lickovci.workers.dev/
5) https://nrsm-streetwear-preview.lickovci.workers.dev/api/health

SECOND EXTRACTION:
1) https://nrsm-streetwear-preview.lickovci.workers.dev/api/
2) https://api.github.com/repos/lickovci-cpu/Business-Control-ONE-17-MAX-/branches/bco/control-plane-v1
3) https://api.github.com/repos/lickovci-cpu/Business-Control-ONE-17-MAX-/commits?sha=bco%2Fcontrol-plane-v1&per_page=1

For every URL report whether content was extracted, extraction errors, title where visible, and HTTP status only if the extractor explicitly provides it. For GitHub report only branch name, commit SHA/date and first commit message line. Do not dump raw JSON.

Interpretation:
- BCO /api/health may report preview=true and backend=not-connected. This is a known preview integration blocker, not a production outage.
- BCO /api/leads may return PREVIEW_BACKEND_NOT_CONNECTED (503); report as expected blocked preview API until Supabase backend binding is configured.
- NŘŠM /api/health should identify preview=true, submissions=disabled, backend=not-connected.
- NŘŠM /api/* may return PREVIEW_API_DISABLED (503); report as expected disabled preview API.
- Successful extraction proves only content retrieval, not end-to-end functionality or HTTP 200 unless explicitly reported.
- An extraction failure is BLOCKED / NOT VERIFIED, never proof of outage.
- Never describe either preview Worker as production.

Report current Europe/Prague date/time, a compact evidence table, CURRENT BLOCKERS, CHANGES SINCE LAST RUN, and NEXT ACTIONS. No messaging, CRM writes, code changes, deployments, spending, publishing, or configuration changes.
