ALTER TABLE public.subcontractors
  ADD COLUMN IF NOT EXISTS bankgiro text,
  ADD COLUMN IF NOT EXISTS plusgiro text,
  ADD COLUMN IF NOT EXISTS payment_terms_days integer,
  ADD COLUMN IF NOT EXISTS payment_reference text;