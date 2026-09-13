-- These three buckets were created ad hoc (via the Lovable/Supabase dashboard) and
-- were never captured in a migration. Reproduced here from the LIVE policy set in
-- production -- verified via
--   select policyname, cmd, roles, qual, with_check
--   from pg_policies where schemaname = 'storage' and tablename = 'objects';
-- run directly in Lovable Cloud's SQL editor on 2026-09-07 -- so this matches actual
-- current behavior exactly rather than a guess. Needed so `supabase db push` recreates
-- an equivalent bucket configuration on the new Supabase project during the Lovable
-- exit migration.
--
-- Every CREATE POLICY is preceded by DROP POLICY IF EXISTS so this migration is safe
-- to re-run (it partially applied once already during a retried `db push`).

INSERT INTO storage.buckets (id, name, public) VALUES
  ('self-check-images', 'self-check-images', false),
  ('self-check-pdfs', 'self-check-pdfs', false),
  ('subcontractor-docs', 'subcontractor-docs', false)
ON CONFLICT (id) DO NOTHING;

-- ===== self-check-images (SELECT/INSERT/DELETE only -- no UPDATE policy exists in
-- production, intentionally not adding one here either, to match live behavior) =====
DROP POLICY IF EXISTS "Users can read self-check images they have job access to" ON storage.objects;
CREATE POLICY "Users can read self-check images they have job access to"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'self-check-images'
  AND (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR private.is_job_owner(((storage.foldername(name))[1])::uuid, auth.uid())
    OR private.is_job_member(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can upload self-check images for jobs they belong to" ON storage.objects;
CREATE POLICY "Users can upload self-check images for jobs they belong to"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'self-check-images'
  AND (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR private.is_job_owner(((storage.foldername(name))[1])::uuid, auth.uid())
    OR private.is_job_member(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can delete self-check images for jobs they belong to" ON storage.objects;
CREATE POLICY "Users can delete self-check images for jobs they belong to"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'self-check-images'
  AND (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR private.is_job_owner(((storage.foldername(name))[1])::uuid, auth.uid())
    OR private.is_job_member(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);

-- ===== self-check-pdfs (full SELECT/INSERT/UPDATE/DELETE set) =====
DROP POLICY IF EXISTS "Users can read self-check pdfs they have job access to" ON storage.objects;
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

DROP POLICY IF EXISTS "Users can upload self-check pdfs for jobs they belong to" ON storage.objects;
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

DROP POLICY IF EXISTS "Users can update self-check pdfs for jobs they belong to" ON storage.objects;
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

DROP POLICY IF EXISTS "Users can delete self-check pdfs for jobs they belong to" ON storage.objects;
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

-- ===== subcontractor-docs (admin: full access; subcontractor: read/upload own only,
-- no self-service update/delete -- admin manages those, matching live behavior) =====
DROP POLICY IF EXISTS "Admins manage subcontractor docs storage" ON storage.objects;
CREATE POLICY "Admins manage subcontractor docs storage"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'subcontractor-docs' AND private.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'subcontractor-docs' AND private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users read own subcontractor docs" ON storage.objects;
CREATE POLICY "Users read own subcontractor docs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'subcontractor-docs' AND owner = auth.uid());

DROP POLICY IF EXISTS "Users upload own subcontractor docs" ON storage.objects;
CREATE POLICY "Users upload own subcontractor docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'subcontractor-docs' AND owner = auth.uid());
