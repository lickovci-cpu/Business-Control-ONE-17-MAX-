# Business Control ONE – MCP

The source now includes `/api/mcp`, a minimal authenticated MCP endpoint focused on Content Worker orchestration and explicit publish preparation. It never publishes by itself.

Set `MCP_API_TOKEN` as a Vercel Sensitive Environment Variable. Keep Meta tokens in `META_PAGE_TOKEN` / `META_USER_TOKEN`.

Recommended flow: status → prepare → review → existing Business Control confirmation → Meta publish.
