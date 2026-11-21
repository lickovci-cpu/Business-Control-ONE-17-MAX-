-- PROPOSAL ONLY. NEVER RUN AGAINST PRODUCTION WITHOUT AN EXPLICIT APPROVAL,
-- a fresh backup of the bucket rows, an isolated test, and a tested rollback.
-- Read-only production inspection on 2026-11-21 found:
-- bco-media: private, no file-size limit, no MIME allowlist.
-- job-media: private, 15 MiB limit, JPEG/PNG/WebP/PDF allowlist.
-- The Cloudflare upload adapter enforces 4 MiB. Match both buckets to that
-- limit so a client cannot bypass the Worker by calling Storage directly.

DO $$
DECLARE
  expected_count integer;
BEGIN
  SELECT count(*) INTO expected_count
    FROM storage.buckets
   WHERE id IN ('bco-media', 'job-media') AND public = false;

  IF expected_count <> 2 THEN
    RAISE EXCEPTION 'EXPECTED_BOTH_PRIVATE_BCO_BUCKETS';
  END IF;

  UPDATE storage.buckets
     SET file_size_limit = 4194304,
         allowed_mime_types = ARRAY[
           'image/jpeg', 'image/png', 'image/webp', 'image/gif',
           'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf'
         ]
   WHERE id = 'bco-media' AND public = false;

  UPDATE storage.buckets
     SET file_size_limit = 4194304,
         allowed_mime_types = ARRAY[
           'image/jpeg', 'image/png', 'image/webp', 'application/pdf'
         ]
   WHERE id = 'job-media' AND public = false;

  IF (SELECT count(*) FROM storage.buckets
       WHERE id IN ('bco-media', 'job-media')
         AND public = false
         AND file_size_limit = 4194304) <> 2 THEN
    RAISE EXCEPTION 'BCO_BUCKET_HARDENING_FAILED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id='bco-media' AND public=false
      AND allowed_mime_types = ARRAY[
        'image/jpeg','image/png','image/webp','image/gif',
        'video/mp4','video/webm','video/quicktime','application/pdf'
      ]
  ) OR NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id='job-media' AND public=false
      AND allowed_mime_types = ARRAY[
        'image/jpeg','image/png','image/webp','application/pdf'
      ]
  ) THEN
    RAISE EXCEPTION 'BCO_BUCKET_MIME_HARDENING_FAILED';
  END IF;
END
$$;

-- ROLLBACK TO THE VALUES OBSERVED ON 2026-11-21 ONLY AFTER CONFIRMING THAT
-- NO ONE HAS CHANGED THESE SETTINGS SINCE THE INSPECTION:
-- UPDATE storage.buckets
--    SET file_size_limit = NULL, allowed_mime_types = NULL
--  WHERE id = 'bco-media' AND public = false;
-- UPDATE storage.buckets
--    SET file_size_limit = 15728640,
--        allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','application/pdf']
--  WHERE id = 'job-media' AND public = false;
