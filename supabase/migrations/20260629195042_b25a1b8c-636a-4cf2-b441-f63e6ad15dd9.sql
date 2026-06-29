
-- 1) Properties: restrict SELECT to admin + saljare
DROP POLICY IF EXISTS "Authenticated users can select properties" ON public.properties;
CREATE POLICY "Admin and saljare can select properties"
  ON public.properties FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'saljare'::app_role));

-- 2) Self-check PDFs bucket: replace permissive policies with job-scoped ones
DROP POLICY IF EXISTS "Anyone can read self-check PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload self-check PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update self-check PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete self-check PDFs" ON storage.objects;

CREATE POLICY "Users can read self-check pdfs they have job access to"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'self-check-pdfs'
    AND (
      private.has_role(auth.uid(), 'admin'::app_role)
      OR private.is_job_owner(((storage.foldername(name))[1])::uuid, auth.uid())
      OR private.is_job_member(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

CREATE POLICY "Users can upload self-check pdfs for jobs they belong to"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'self-check-pdfs'
    AND (
      private.has_role(auth.uid(), 'admin'::app_role)
      OR private.is_job_owner(((storage.foldername(name))[1])::uuid, auth.uid())
      OR private.is_job_member(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

CREATE POLICY "Users can update self-check pdfs for jobs they belong to"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'self-check-pdfs'
    AND (
      private.has_role(auth.uid(), 'admin'::app_role)
      OR private.is_job_owner(((storage.foldername(name))[1])::uuid, auth.uid())
      OR private.is_job_member(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  )
  WITH CHECK (
    bucket_id = 'self-check-pdfs'
    AND (
      private.has_role(auth.uid(), 'admin'::app_role)
      OR private.is_job_owner(((storage.foldername(name))[1])::uuid, auth.uid())
      OR private.is_job_member(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

CREATE POLICY "Users can delete self-check pdfs for jobs they belong to"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'self-check-pdfs'
    AND (
      private.has_role(auth.uid(), 'admin'::app_role)
      OR private.is_job_owner(((storage.foldername(name))[1])::uuid, auth.uid())
      OR private.is_job_member(((storage.foldername(name))[1])::uuid, auth.uid())
    )
  );

-- 3) Revoke anon EXECUTE on SECURITY DEFINER functions that don't need it.
-- get_invitation_by_token is intentionally callable by anon (invite acceptance flow).
REVOKE EXECUTE ON FUNCTION public.list_users_with_role(app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, PUBLIC;
