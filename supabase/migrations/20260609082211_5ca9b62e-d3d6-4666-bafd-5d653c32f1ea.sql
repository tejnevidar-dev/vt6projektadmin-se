CREATE TABLE public.job_estimate_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('hide','show','update_hours')),
  old_value numeric,
  new_value numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX job_estimate_audit_job_id_idx ON public.job_estimate_audit(job_id, created_at DESC);

GRANT SELECT, INSERT ON public.job_estimate_audit TO authenticated;
GRANT ALL ON public.job_estimate_audit TO service_role;

ALTER TABLE public.job_estimate_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read estimate audit"
  ON public.job_estimate_audit
  FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert estimate audit"
  ON public.job_estimate_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::public.app_role)
    AND user_id = auth.uid()
  );