CREATE POLICY "Admins manage subcontractor docs storage" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'subcontractor-docs' AND private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'subcontractor-docs' AND private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users upload own subcontractor docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'subcontractor-docs' AND owner = auth.uid());

CREATE POLICY "Users read own subcontractor docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'subcontractor-docs' AND owner = auth.uid());