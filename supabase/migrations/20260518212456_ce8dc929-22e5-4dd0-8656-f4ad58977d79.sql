
CREATE TABLE public.lead_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_documents_lead_id ON public.lead_documents(lead_id);

ALTER TABLE public.lead_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read lead documents"
  ON public.lead_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Saljare and admin can insert lead documents"
  ON public.lead_documents FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'saljare'::app_role));

CREATE POLICY "Saljare and admin can delete lead documents"
  ON public.lead_documents FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'saljare'::app_role));

INSERT INTO storage.buckets (id, name, public) VALUES ('lead-documents', 'lead-documents', false);

CREATE POLICY "Authenticated can read lead-documents files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lead-documents');

CREATE POLICY "Saljare and admin can upload lead-documents files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lead-documents' AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'saljare'::app_role)));

CREATE POLICY "Saljare and admin can delete lead-documents files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lead-documents' AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'saljare'::app_role)));
