-- Restrict profile visibility: only admins can see all profiles; others see only their own.
DROP POLICY IF EXISTS "Authenticated can read profiles" ON public.profiles;

CREATE POLICY "Users read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));