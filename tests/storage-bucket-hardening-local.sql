DO $$
BEGIN
  IF (SELECT count(*) FROM storage.buckets
       WHERE id IN ('bco-media','job-media')
         AND public = false
         AND file_size_limit = 4194304) <> 2 THEN
    RAISE EXCEPTION 'LOCAL_BUCKET_SIZE_LIMITS_NOT_APPLIED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
     WHERE id='bco-media' AND public=false
       AND allowed_mime_types = ARRAY[
         'image/jpeg','image/png','image/webp','image/gif',
         'video/mp4','video/webm','video/quicktime','application/pdf'
       ]
  ) THEN RAISE EXCEPTION 'LOCAL_BCO_MEDIA_MIME_ALLOWLIST_INVALID'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
     WHERE id='job-media' AND public=false
       AND allowed_mime_types = ARRAY[
         'image/jpeg','image/png','image/webp','application/pdf'
       ]
  ) THEN RAISE EXCEPTION 'LOCAL_JOB_MEDIA_MIME_ALLOWLIST_INVALID'; END IF;
END
$$;
