
-- Fix: Revoke public execute on SECURITY DEFINER RPC; lookups now happen via server-side admin route.
REVOKE EXECUTE ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC, anon, authenticated;

-- Fix: Allow admins to read email send state via the app (previously service_role only).
CREATE POLICY "Admins can view email send state"
ON public.email_send_state
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));
