#!/usr/bin/env bash
set -euo pipefail
psql -X -qAt -v ON_ERROR_STOP=1 -c "BEGIN; SELECT id FROM public.claim_integration_outbox(1); SELECT pg_sleep(2); COMMIT" > /tmp/bco-claim-a.txt &
pid=$!
sleep 0.35
psql -X -qAt -v ON_ERROR_STOP=1 -c "SELECT id FROM public.claim_integration_outbox(1)" > /tmp/bco-claim-b.txt
wait "$pid"
a="$(grep -Eo '[0-9a-f-]{36}' /tmp/bco-claim-a.txt | head -n1)"
b="$(grep -Eo '[0-9a-f-]{36}' /tmp/bco-claim-b.txt | head -n1)"
test -n "$a" && test -n "$b"
test "$a" != "$b"
echo "PASS: concurrent claims are distinct ($a != $b)"
