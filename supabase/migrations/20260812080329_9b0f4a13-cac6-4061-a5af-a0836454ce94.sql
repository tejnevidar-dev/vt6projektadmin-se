ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS personal_number text,
  ADD COLUMN IF NOT EXISTS rot_eligible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS invoiced boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoiced_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_due_date date,
  ADD COLUMN IF NOT EXISTS rot_applied_at timestamptz;

CREATE INDEX IF NOT EXISTS leads_invoice_due_date_idx ON public.leads (invoice_due_date);

CREATE POLICY "Ekonomi can select leads"
ON public.leads FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'ekonomi'::app_role));

CREATE POLICY "Ekonomi can update leads"
ON public.leads FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'ekonomi'::app_role))
WITH CHECK (private.has_role(auth.uid(), 'ekonomi'::app_role));

CREATE POLICY "Ekonomi can select properties"
ON public.properties FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'ekonomi'::app_role));