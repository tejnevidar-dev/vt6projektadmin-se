
-- 1) Remove public.has_role (policies reference private.has_role)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- 2) Invitations: stop letting anon enumerate active invitations
DROP POLICY IF EXISTS "Anyone can read invitation by token" ON public.invitations;
CREATE POLICY "Authenticated can read invitation by token"
  ON public.invitations
  FOR SELECT
  TO authenticated
  USING (used_at IS NULL AND expires_at > now());

-- 3) Storage: restrict offers + lead-documents reads to admin/saljare only
DROP POLICY IF EXISTS "Authenticated can read offer pdfs" ON storage.objects;
CREATE POLICY "Saljare and admin can read offer pdfs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'offers'
    AND (private.has_role(auth.uid(), 'admin'::public.app_role)
         OR private.has_role(auth.uid(), 'saljare'::public.app_role))
  );

DROP POLICY IF EXISTS "Authenticated can read lead-documents files" ON storage.objects;
CREATE POLICY "Saljare and admin can read lead-documents files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'lead-documents'
    AND (private.has_role(auth.uid(), 'admin'::public.app_role)
         OR private.has_role(auth.uid(), 'saljare'::public.app_role))
  );
