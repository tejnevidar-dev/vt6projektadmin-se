BEGIN;

-- Allow authenticated users to upload files to self-check-pdfs bucket
CREATE POLICY "Authenticated users can upload self-check PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'self-check-pdfs'
);

-- Allow authenticated users to update their own files in self-check-pdfs bucket
CREATE POLICY "Authenticated users can update self-check PDFs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'self-check-pdfs'
)
WITH CHECK (
  bucket_id = 'self-check-pdfs'
);

-- Allow authenticated users to delete their own files in self-check-pdfs bucket
CREATE POLICY "Authenticated users can delete self-check PDFs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'self-check-pdfs'
);

-- Allow anyone (including clients without login) to read/download PDFs
CREATE POLICY "Anyone can read self-check PDFs"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'self-check-pdfs'
);

COMMIT;