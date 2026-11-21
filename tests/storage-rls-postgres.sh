#!/usr/bin/env bash
set -euo pipefail
ORG_A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
ORG_B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
USER_A='11111111-1111-4111-8111-111111111111'
USER_B='22222222-2222-4222-8222-222222222222'
JOB_A='33333333-3333-4333-8333-333333333333'
JOB_UNASSIGNED='44444444-4444-4444-8444-444444444444'

psql -X -v ON_ERROR_STOP=1 -c "SET ROLE authenticated; SET request.jwt.claim.sub='$USER_A'; INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES ('bco-media','$ORG_A/allowed.jpg','$USER_A');"
psql -X -v ON_ERROR_STOP=1 -c "SET ROLE authenticated; SET request.jwt.claim.sub='$USER_B'; INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES ('bco-media','$ORG_B/allowed.jpg','$USER_B');"
if psql -X -v ON_ERROR_STOP=1 -c "SET ROLE authenticated; SET request.jwt.claim.sub='$USER_A'; INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES ('bco-media','$ORG_B/denied.jpg','$USER_A');"; then
  echo "FAIL: cross-organization bco-media upload allowed"; exit 1
else
  echo "PASS: cross-organization bco-media upload denied"
fi
psql -X -v ON_ERROR_STOP=1 -c "SET ROLE authenticated; SET request.jwt.claim.sub='$USER_A'; INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES ('job-media','$ORG_A/$JOB_A/assigned.pdf','$USER_A');"
if psql -X -v ON_ERROR_STOP=1 -c "SET ROLE authenticated; SET request.jwt.claim.sub='$USER_A'; INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES ('job-media','$ORG_A/$JOB_UNASSIGNED/unassigned.pdf','$USER_A');"; then
  echo "FAIL: unassigned job upload allowed"; exit 1
else
  echo "PASS: unassigned job upload denied"
fi
visible="$(psql -X -qAt -v ON_ERROR_STOP=1 -c "SET ROLE authenticated; SET request.jwt.claim.sub='$USER_A'; SELECT count(*) FROM storage.objects WHERE bucket_id='bco-media';")"
test "$visible" = "1"
echo "PASS: org member can read only own org objects"
