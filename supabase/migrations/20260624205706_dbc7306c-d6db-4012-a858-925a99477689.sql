
-- 1) invitations: remove broad read; add secure token lookup
DROP POLICY IF EXISTS "Authenticated can read invitation by token" ON public.invitations;

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token text)
RETURNS TABLE(email text, role public.app_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.email, i.role
  FROM public.invitations i
  WHERE i.token = _token
    AND i.used_at IS NULL
    AND i.expires_at > now()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;

-- 2) lead_activities: restrict read to admin/saljare
DROP POLICY IF EXISTS "Authenticated can read activities" ON public.lead_activities;
CREATE POLICY "Admin and saljare can read activities"
ON public.lead_activities
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'saljare'::app_role));

-- 3) storage lead-documents: add UPDATE policy
CREATE POLICY "Saljare and admin can update lead-documents files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'lead-documents' AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'saljare'::app_role)))
WITH CHECK (bucket_id = 'lead-documents' AND (private.has_role(auth.uid(), 'admin'::app_role) OR private.has_role(auth.uid(), 'saljare'::app_role)));

-- 4) Pin search_path on email queue functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
