ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS price numeric,
  ADD COLUMN IF NOT EXISTS assignment_type text,
  ADD COLUMN IF NOT EXISTS subcontractor_name text,
  ADD COLUMN IF NOT EXISTS subcontractor_price numeric,
  ADD COLUMN IF NOT EXISTS foreman_name text;