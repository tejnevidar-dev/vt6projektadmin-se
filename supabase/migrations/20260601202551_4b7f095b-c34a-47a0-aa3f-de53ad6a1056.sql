
REVOKE EXECUTE ON FUNCTION public.is_internal_user(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_external_user(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_internal_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_external_user(uuid) TO authenticated, service_role;
