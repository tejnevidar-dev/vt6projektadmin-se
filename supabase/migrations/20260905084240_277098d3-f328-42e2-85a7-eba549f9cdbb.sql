ALTER TABLE public.subcontractors
  ADD COLUMN IF NOT EXISTS invoice_email text,
  ADD COLUMN IF NOT EXISTS invoice_address text;