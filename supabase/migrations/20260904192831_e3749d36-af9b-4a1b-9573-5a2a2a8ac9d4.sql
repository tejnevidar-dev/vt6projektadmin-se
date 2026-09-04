CREATE OR REPLACE FUNCTION private.owns_subcontractor(_subcontractor_id uuid)
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

DROP POLICY "Subcontractor sees own documents" ON public.subcontractor_documents;
DROP POLICY "Subcontractor uploads own documents" ON public.subcontractor_documents;
DROP POLICY "Subcontractor sees own invoices" ON public.subcontractor_invoices;

CREATE POLICY "Subcontractor sees own documents" ON public.subcontractor_documents
  FOR SELECT TO authenticated
  USING (private.owns_subcontractor(subcontractor_id));

CREATE POLICY "Subcontractor uploads own documents" ON public.subcontractor_documents
  FOR INSERT TO authenticated
  WITH CHECK (private.owns_subcontractor(subcontractor_id) AND uploaded_by = auth.uid());

CREATE POLICY "Subcontractor sees own invoices" ON public.subcontractor_invoices
  FOR SELECT TO authenticated
  USING (submitted_by = auth.uid() OR private.owns_subcontractor(subcontractor_id));

DROP FUNCTION IF EXISTS public.owns_subcontractor(uuid);