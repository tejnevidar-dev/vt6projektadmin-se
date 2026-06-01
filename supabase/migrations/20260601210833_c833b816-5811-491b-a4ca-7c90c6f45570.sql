-- jobs columns for uploaded work order
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS work_order_pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS work_order_summary TEXT,
  ADD COLUMN IF NOT EXISTS work_order_processed_at TIMESTAMPTZ;

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('work-orders', 'work-orders', false)
ON CONFLICT (id) DO NOTHING;

-- Helper: check if current user has access to a job referenced by storage path
-- path format: <job_id>/<filename>
-- Policies use private.has_role / public functions already present.

-- SELECT (read) policy
CREATE POLICY "Work orders readable by job participants"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'work-orders'
  AND (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_job_owner((split_part(name, '/', 1))::uuid, auth.uid())
    OR public.is_job_member((split_part(name, '/', 1))::uuid, auth.uid())
  )
);

-- INSERT (upload) policy: admin or job owner only
CREATE POLICY "Work orders uploadable by admin or owner"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'work-orders'
  AND (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_job_owner((split_part(name, '/', 1))::uuid, auth.uid())
  )
);

-- DELETE policy: admin or owner
CREATE POLICY "Work orders deletable by admin or owner"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'work-orders'
  AND (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR public.is_job_owner((split_part(name, '/', 1))::uuid, auth.uid())
  )
);