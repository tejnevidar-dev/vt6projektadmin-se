CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

ALTER POLICY "Users can read their own roles"
ON public.user_roles
USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins manage roles"
ON public.user_roles
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins update any profile"
ON public.profiles
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins manage invitations"
ON public.invitations
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Saljare and admin can insert leads"
ON public.leads
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'saljare'::public.app_role));

ALTER POLICY "Saljare and admin can update leads"
ON public.leads
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'saljare'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'saljare'::public.app_role));

ALTER POLICY "Admins can delete leads"
ON public.leads
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Saljare and admin can insert properties"
ON public.properties
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'saljare'::public.app_role));

ALTER POLICY "Saljare and admin can update properties"
ON public.properties
USING (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'saljare'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role) OR private.has_role(auth.uid(), 'saljare'::public.app_role));

ALTER POLICY "Admins can delete properties"
ON public.properties
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins can view webhook logs"
ON public.webhook_logs
USING (private.has_role(auth.uid(), 'admin'::public.app_role));