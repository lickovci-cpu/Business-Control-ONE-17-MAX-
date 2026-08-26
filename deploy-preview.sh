#!/usr/bin/env bash
set -euo pipefail
TEAM="wemone-5402s-projects"
PROJECT="business-control-one"
vc(){ if command -v vercel >/dev/null 2>&1; then vercel "$@"; else npx --yes vercel@latest "$@"; fi; }
node --check public/app.js
node scripts/check.mjs
node tests/smoke.mjs
vc link --yes --project "$PROJECT" --scope "$TEAM" >/dev/null
vc deploy --yes --scope "$TEAM"
