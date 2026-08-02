CREATE TABLE public.signature_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  offer_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  base_pdf_path TEXT NOT NULL,
  signed_pdf_path TEXT,
  total_amount NUMERIC,

  company_signer_name TEXT NOT NULL,
  company_signature_png TEXT NOT NULL,
  company_place TEXT NOT NULL,
  company_date DATE NOT NULL,
  company_signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  customer_signer_name TEXT,
  customer_signature_png TEXT,
  customer_place TEXT,
  customer_date DATE,
  customer_signed_at TIMESTAMPTZ,
  customer_ip TEXT,
  customer_user_agent TEXT,

  otp_code_hash TEXT,
  otp_sent_at TIMESTAMPTZ,
  otp_verified_at TIMESTAMPTZ,
  otp_attempts INT NOT NULL DEFAULT 0,

  viewed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT signature_requests_status_chk CHECK (status IN ('pending','viewed','signed','expired','cancelled'))
);

CREATE INDEX idx_signature_requests_created_by ON public.signature_requests(created_by);
CREATE INDEX idx_signature_requests_lead ON public.signature_requests(lead_id);
CREATE INDEX idx_signature_requests_status ON public.signature_requests(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.signature_requests TO authenticated;
GRANT ALL ON public.signature_requests TO service_role;

ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view own signature requests"
ON public.signature_requests FOR SELECT TO authenticated
USING (created_by = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Staff can create signature requests"
ON public.signature_requests FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Staff can update own signature requests"
ON public.signature_requests FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (created_by = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete signature requests"
ON public.signature_requests FOR DELETE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_signature_requests_updated_at
BEFORE UPDATE ON public.signature_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();