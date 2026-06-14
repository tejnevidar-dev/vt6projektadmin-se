
CREATE OR REPLACE FUNCTION public.list_users_with_role(_role app_role)
 RETURNS TABLE(id uuid, display_name text, email text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.display_name, p.email
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.role = _role
    ORDER BY COALESCE(p.display_name, p.email);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.list_users_with_role(app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_users_with_role(app_role) TO authenticated;
