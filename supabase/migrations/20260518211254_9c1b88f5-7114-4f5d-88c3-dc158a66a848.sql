-- Add offer PDF storage column
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS offer_pdf_path text;

-- Create private storage bucket for offer PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('offers', 'offers', false)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can view offer PDFs
CREATE POLICY "Authenticated can read offer pdfs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'offers');

-- Saljare/admin can upload offer PDFs
CREATE POLICY "Saljare and admin can upload offer pdfs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'offers' AND (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR private.has_role(auth.uid(), 'saljare'::app_role)
  )
);

-- Saljare/admin can update offer PDFs
CREATE POLICY "Saljare and admin can update offer pdfs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'offers' AND (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR private.has_role(auth.uid(), 'saljare'::app_role)
  )
);

-- Saljare/admin can delete offer PDFs
CREATE POLICY "Saljare and admin can delete offer pdfs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'offers' AND (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR private.has_role(auth.uid(), 'saljare'::app_role)
  )
);
