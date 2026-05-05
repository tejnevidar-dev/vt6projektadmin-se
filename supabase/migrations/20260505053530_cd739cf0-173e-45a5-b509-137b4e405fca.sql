
CREATE TABLE public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'roslagstak',
  status_code INTEGER NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  payload JSONB,
  headers JSONB,
  lead_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view webhook logs"
ON public.webhook_logs FOR SELECT
TO authenticated
USING (true);

CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs (created_at DESC);
