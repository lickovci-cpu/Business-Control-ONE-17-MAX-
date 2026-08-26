# BC Content Worker – 17 MAX change set

Implemented locally and validated without touching production:

- Added a dedicated `Content Worker` UI tab.
- Added worker goal/offer/audience/day controls.
- Worker orchestrates existing `weekly` + `campaign` AI tasks.
- Saves `lastContentWorker` into the existing project state.
- Creates a ready queue for Post/Reel/Story handoff.
- Keeps Meta publishing behind the existing confirmation flow.
- Added a minimal authenticated MCP endpoint at `/api/mcp` for status/prepare/publish-preparation tools; it never publishes directly.
- Added `MCP_SETUP.md`.
- Added `deploy-preview.sh`.
- Changed `deploy.sh` to safe mode: production deploy requires `ALLOW_PROD_DEPLOY=YES`.
- Existing tests pass.
