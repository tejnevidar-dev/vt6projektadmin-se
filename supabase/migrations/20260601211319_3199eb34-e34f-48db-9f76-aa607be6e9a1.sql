ALTER TABLE public.self_checks
  ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS review_notes text;

CREATE INDEX IF NOT EXISTS idx_self_checks_completed_reviewed
  ON public.self_checks (completed_at, reviewed_at);