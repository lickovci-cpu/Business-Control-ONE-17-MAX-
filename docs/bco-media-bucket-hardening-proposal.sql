-- PROPOSAL ONLY. DO NOT RUN AGAINST PRODUCTION WITHOUT APPROVAL + BACKUP + ROLLBACK.
-- Enforces the same upload boundary as api/cloud-storage.js even when a client
-- with a valid Supabase JWT calls Storage directly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'bco-media' AND public = false
  ) THEN
    RAISE EXCEPTION 'EXPECTED_PRIVATE_BCO_MEDIA_BUCKET_NOT_FOUND';
  END IF;

  UPDATE storage.buckets
     SET file_size_limit = 4194304,
         allowed_mime_types = ARRAY[
           'image/jpeg',
           'image/png',
           'image/webp',
           'image/gif',
           'video/mp4',
           'video/webm',
           'video/quicktime',
           'application/pdf'
         ]
   WHERE id = 'bco-media' AND public = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BCO_MEDIA_BUCKET_HARDENING_FAILED';
  END IF;
END
$$;

-- Rollback proposal (only if the previous bucket settings are recorded first):
-- UPDATE storage.buckets SET file_size_limit = <PREVIOUS_LIMIT>,
--   allowed_mime_types = <PREVIOUS_MIME_ARRAY> WHERE id = 'bco-media';
