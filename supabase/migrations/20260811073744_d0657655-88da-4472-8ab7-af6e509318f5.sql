CREATE TABLE public.self_check_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  self_check_id uuid REFERENCES public.self_checks(id) ON DELETE SET NULL,
  template_key text NOT NULL,
  recipient_email text,
  status text NOT NULL CHECK (status IN ('sent','failed')),
  attempt integer NOT NULL DEFAULT 1,
  error_message text,
  skipped_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  embedded_image_count integer NOT NULL DEFAULT 0,
  pdf_path text,
  triggered_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_self_check_deliveries_job ON public.self_check_deliveries(job_id, created_at DESC);
CREATE INDEX idx_self_check_deliveries_check ON public.self_check_deliveries(self_check_id);

GRANT SELECT ON public.self_check_deliveries TO authenticated;
GRANT ALL ON public.self_check_deliveries TO service_role;

ALTER TABLE public.self_check_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View deliveries for own or admin jobs"
ON public.self_check_deliveries
FOR SELECT
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = self_check_deliveries.job_id AND j.assigned_to = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.job_members m
    WHERE m.job_id = self_check_deliveries.job_id AND m.user_id = auth.uid()
  )
);