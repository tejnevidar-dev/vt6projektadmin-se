-- 1. Register över underentreprenörer
CREATE TABLE public.subcontractors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  company_name text NOT NULL,
  org_number text,
  contact_name text,
  email text,
  phone text,
  address text,
  f_skatt boolean NOT NULL DEFAULT false,
  insurance_company text,
  insurance_expires_at date,
  agreement_signed_at date,
  hourly_rate numeric,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subcontractors TO authenticated;
GRANT ALL ON public.subcontractors TO service_role;

ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage subcontractors" ON public.subcontractors
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Subcontractor sees own company" ON public.subcontractors
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_subcontractors_updated_at
  BEFORE UPDATE ON public.subcontractors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Hjälpfunktion: äger inloggad användare denna UE-post?
CREATE OR REPLACE FUNCTION public.owns_subcontractor(_subcontractor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subcontractors s
    WHERE s.id = _subcontractor_id AND s.user_id = auth.uid()
  );
$$;

-- 2. Dokument (avtal, försäkring, F-skatt)
CREATE TABLE public.subcontractor_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_id uuid NOT NULL REFERENCES public.subcontractors(id) ON DELETE CASCADE,
  doc_type text NOT NULL DEFAULT 'ovrigt',
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size bigint,
  valid_until date,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subcontractor_documents TO authenticated;
GRANT ALL ON public.subcontractor_documents TO service_role;

ALTER TABLE public.subcontractor_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage subcontractor documents" ON public.subcontractor_documents
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Subcontractor sees own documents" ON public.subcontractor_documents
  FOR SELECT TO authenticated
  USING (public.owns_subcontractor(subcontractor_id));

CREATE POLICY "Subcontractor uploads own documents" ON public.subcontractor_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.owns_subcontractor(subcontractor_id) AND uploaded_by = auth.uid());

CREATE INDEX idx_sc_documents_sc ON public.subcontractor_documents(subcontractor_id);

-- 3. UE-fakturor per projekt
CREATE TABLE public.subcontractor_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  subcontractor_id uuid REFERENCES public.subcontractors(id) ON DELETE SET NULL,
  submitted_by uuid,
  invoice_number text,
  invoice_date date,
  due_date date,
  amount numeric NOT NULL DEFAULT 0,
  vat_amount numeric,
  file_path text,
  file_name text,
  status text NOT NULL DEFAULT 'mottagen',
  approved_by uuid,
  approved_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subcontractor_invoices_status_check
    CHECK (status IN ('mottagen', 'godkand', 'avvisad', 'betald'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subcontractor_invoices TO authenticated;
GRANT ALL ON public.subcontractor_invoices TO service_role;

ALTER TABLE public.subcontractor_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage subcontractor invoices" ON public.subcontractor_invoices
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Subcontractor sees own invoices" ON public.subcontractor_invoices
  FOR SELECT TO authenticated
  USING (submitted_by = auth.uid() OR public.owns_subcontractor(subcontractor_id));

CREATE POLICY "Subcontractor submits invoices on own jobs" ON public.subcontractor_invoices
  FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND private.is_job_owner(job_id, auth.uid()));

CREATE POLICY "Subcontractor edits own pending invoices" ON public.subcontractor_invoices
  FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() AND status = 'mottagen')
  WITH CHECK (submitted_by = auth.uid() AND status = 'mottagen');

CREATE INDEX idx_sc_invoices_job ON public.subcontractor_invoices(job_id);
CREATE INDEX idx_sc_invoices_sc ON public.subcontractor_invoices(subcontractor_id);

CREATE TRIGGER trg_subcontractor_invoices_updated_at
  BEFORE UPDATE ON public.subcontractor_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Koppling projekt -> underentreprenör
ALTER TABLE public.jobs
  ADD COLUMN subcontractor_id uuid REFERENCES public.subcontractors(id) ON DELETE SET NULL;