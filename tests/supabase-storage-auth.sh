#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${GITHUB_WORKSPACE:-$(pwd)}"
TEST_ROOT="${RUNNER_TEMP:-/tmp}/bco-supabase-storage-auth"
ENV_FILE="$TEST_ROOT/supabase.env"
mkdir -p "$TEST_ROOT"
cd "$TEST_ROOT"

cleanup() {
  supabase stop >/dev/null 2>&1 || true
}
trap cleanup EXIT

# This folder has no linked project reference: all commands target the local stack.
supabase init
mkdir -p supabase/migrations
cp "$WORKSPACE/tests/supabase-storage-test-schema.sql" supabase/migrations/20261121000100_bco_storage_test.sql
cp "$WORKSPACE/docs/integration-outbox-schema-proposal.sql" supabase/migrations/20261121000200_bco_outbox.sql

supabase start -x studio,mail,analytics,realtime,functions,pooler
supabase db reset --local
supabase status --env --output-format text > "$ENV_FILE"
set -a
source "$ENV_FILE"
set +a

: "${API_URL:?Missing local Supabase API_URL}"
: "${DB_URL:?Missing local Supabase DB_URL}"
: "${PUBLISHABLE_KEY:?Missing local Supabase PUBLISHABLE_KEY}"
: "${SERVICE_ROLE_KEY:?Missing local Supabase SERVICE_ROLE_KEY}"

ORG_A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
ORG_B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
JOB_A='33333333-3333-4333-8333-333333333333'
JOB_UNASSIGNED='44444444-4444-4444-8444-444444444444'
PASSWORD='Local-Only-Test-Password-2026!'

create_user() {
  local email="$1"
  curl -fsS "$API_URL/auth/v1/admin/users" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\",\"email_confirm\":true}"
}

USER_A_JSON="$(create_user 'bco-a@example.test')"
USER_B_JSON="$(create_user 'bco-b@example.test')"
USER_A_ID="$(printf '%s' "$USER_A_JSON" | jq -r '.id')"
USER_B_ID="$(printf '%s' "$USER_B_JSON" | jq -r '.id')"
test -n "$USER_A_ID" && test "$USER_A_ID" != "null"
test -n "$USER_B_ID" && test "$USER_B_ID" != "null"

psql "$DB_URL" -v ON_ERROR_STOP=1 -v user_a="$USER_A_ID" -v user_b="$USER_B_ID" <<SQL
insert into public.organizations(id,name) values
('$ORG_A','Test Org A'),('$ORG_B','Test Org B');
insert into public.memberships(organization_id,user_id,role) values
('$ORG_A', :'user_a'::uuid, 'worker'),
('$ORG_B', :'user_b'::uuid, 'worker');
insert into public.jobs(id,organization_id) values
('$JOB_A','$ORG_A'),
('$JOB_UNASSIGNED','$ORG_A');
insert into public.job_assignments(organization_id,job_id,user_id) values
('$ORG_A','$JOB_A',:'user_a'::uuid);
SQL

login() {
  local email="$1"
  curl -fsS "$API_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $PUBLISHABLE_KEY" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}" | jq -r '.access_token'
}
TOKEN_A="$(login 'bco-a@example.test')"
TOKEN_B="$(login 'bco-b@example.test')"
test -n "$TOKEN_A" && test "$TOKEN_A" != "null"
test -n "$TOKEN_B" && test "$TOKEN_B" != "null"

VERIFIED_A="$(curl -fsS "$API_URL/auth/v1/user" -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $TOKEN_A" | jq -r '.id')"
test "$VERIFIED_A" = "$USER_A_ID"
echo "PASS: Supabase Auth issued and verified a real local JWT"

FORGED_STATUS="$(curl -sS -o /tmp/bco-forged-jwt.json -w '%{http_code}' "$API_URL/auth/v1/user" -H "apikey: $PUBLISHABLE_KEY" -H 'Authorization: Bearer forged.invalid.token')"
test "$FORGED_STATUS" = "401"
echo "PASS: forged JWT rejected by local Supabase Auth"

upload() {
  local bucket="$1" path="$2" token="$3" mime="$4" data="$5"
  curl -sS -o /tmp/bco-storage-response.json -w '%{http_code}' \
    -X POST "$API_URL/storage/v1/object/$bucket/$path" \
    -H "apikey: $PUBLISHABLE_KEY" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: $mime" \
    --data-binary "$data"
}

status="$(upload bco-media "$ORG_A/allowed.jpg" "$TOKEN_A" image/jpeg 'local-test-jpeg')"
case "$status" in 200|201) ;; *) cat /tmp/bco-storage-response.json; echo "FAIL: member upload returned $status"; exit 1;; esac
echo "PASS: org member uploaded to own private bco-media folder"

status="$(upload bco-media "$ORG_B/forbidden.jpg" "$TOKEN_A" image/jpeg 'cross-org-test')"
case "$status" in 200|201) echo "FAIL: cross-org upload succeeded"; exit 1;; *) echo "PASS: cross-org upload denied ($status)";; esac

status="$(upload bco-media "$ORG_B/allowed.jpg" "$TOKEN_B" image/jpeg 'org-b-test')"
case "$status" in 200|201) ;; *) cat /tmp/bco-storage-response.json; echo "FAIL: org B member upload returned $status"; exit 1;; esac

status="$(upload job-media "$ORG_A/$JOB_A/assigned.pdf" "$TOKEN_A" application/pdf 'assigned-job-test')"
case "$status" in 200|201) ;; *) cat /tmp/bco-storage-response.json; echo "FAIL: assigned job upload returned $status"; exit 1;; esac
status="$(upload job-media "$ORG_A/$JOB_UNASSIGNED/unassigned.pdf" "$TOKEN_A" application/pdf 'unassigned-job-test')"
case "$status" in 200|201) echo "FAIL: unassigned job upload succeeded"; exit 1;; *) echo "PASS: unassigned job upload denied ($status)";; esac

status="$(curl -sS -o /tmp/bco-own-download.bin -w '%{http_code}' "$API_URL/storage/v1/object/authenticated/bco-media/$ORG_A/allowed.jpg" -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $TOKEN_A")"
case "$status" in 200) ;; *) echo "FAIL: own private download returned $status"; exit 1;; esac
status="$(curl -sS -o /tmp/bco-cross-download.json -w '%{http_code}' "$API_URL/storage/v1/object/authenticated/bco-media/$ORG_B/allowed.jpg" -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $TOKEN_A")"
case "$status" in 200|206) echo "FAIL: cross-org private download succeeded"; exit 1;; *) echo "PASS: cross-org private download denied ($status)";; esac

status="$(upload bco-media "$ORG_A/wrong-type.txt" "$TOKEN_A" text/plain 'not-allowed')"
case "$status" in 200|201) echo "FAIL: disallowed MIME uploaded"; exit 1;; *) echo "PASS: bucket MIME allowlist enforced ($status)";; esac

dd if=/dev/zero of=/tmp/bco-over-limit.bin bs=1048576 count=4 status=none
printf x >> /tmp/bco-over-limit.bin
status="$(curl -sS -o /tmp/bco-over-limit.json -w '%{http_code}' -X POST "$API_URL/storage/v1/object/bco-media/$ORG_A/too-large.jpg" -H "apikey: $PUBLISHABLE_KEY" -H "Authorization: Bearer $TOKEN_A" -H 'Content-Type: image/jpeg' --data-binary @/tmp/bco-over-limit.bin)"
case "$status" in 200|201) echo "FAIL: oversized upload succeeded"; exit 1;; *) echo "PASS: bucket size limit enforced ($status)";; esac

echo "PASS: local Supabase Auth JWT + private Storage RLS integration suite"
