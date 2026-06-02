
-- RLS for self-check-images bucket
CREATE POLICY "Users can read self-check images they have job access to"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'self-check-images'
  AND (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR is_job_owner(((storage.foldername(name))[1])::uuid, auth.uid())
    OR is_job_member(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);

CREATE POLICY "Users can upload self-check images for jobs they belong to"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'self-check-images'
  AND (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR is_job_owner(((storage.foldername(name))[1])::uuid, auth.uid())
    OR is_job_member(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);

CREATE POLICY "Users can delete self-check images for jobs they belong to"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'self-check-images'
  AND (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR is_job_owner(((storage.foldername(name))[1])::uuid, auth.uid())
    OR is_job_member(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);
