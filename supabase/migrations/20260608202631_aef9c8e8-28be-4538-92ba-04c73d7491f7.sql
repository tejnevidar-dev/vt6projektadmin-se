
CREATE OR REPLACE FUNCTION public.list_users_with_role(_role public.app_role)
RETURNS TABLE (id uuid, display_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.email
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role = _role
  ORDER BY COALESCE(p.display_name, p.email);
$$;

GRANT EXECUTE ON FUNCTION public.list_users_with_role(public.app_role) TO authenticated;
