ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS created_by uuid;
CREATE INDEX IF NOT EXISTS idx_leads_created_by ON public.leads(created_by);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);