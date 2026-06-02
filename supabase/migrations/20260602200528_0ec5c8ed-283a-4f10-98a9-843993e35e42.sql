
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS client_contact_name text,
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS self_checks_emailed_at timestamptz,
  ADD COLUMN IF NOT EXISTS self_checks_emailed_to text;
