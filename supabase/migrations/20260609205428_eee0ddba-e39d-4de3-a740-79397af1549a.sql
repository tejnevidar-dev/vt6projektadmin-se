CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_found BOOLEAN := FALSE;
  v_admin_count INT;
  v_assigned_role public.app_role;
  v_invite_token TEXT;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );

  v_invite_token := NEW.raw_user_meta_data->>'invite_token';

  IF v_invite_token IS NOT NULL THEN
    SELECT * INTO v_invite FROM public.invitations
    WHERE token = v_invite_token AND used_at IS NULL AND expires_at > now()
    LIMIT 1;
    v_found := FOUND;
  END IF;

  IF NOT v_found THEN
    SELECT * INTO v_invite FROM public.invitations
    WHERE lower(email) = lower(NEW.email) AND used_at IS NULL AND expires_at > now()
    ORDER BY created_at DESC LIMIT 1;
    v_found := FOUND;
  END IF;

  IF v_found THEN
    v_assigned_role := v_invite.role;
    UPDATE public.invitations
    SET used_at = now(), used_by = NEW.id
    WHERE id = v_invite.id;
  ELSE
    SELECT COUNT(*) INTO v_admin_count FROM public.user_roles WHERE role = 'admin';
    IF v_admin_count = 0 THEN
      v_assigned_role := 'admin';
    ELSE
      v_assigned_role := 'viewer';
    END IF;
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_assigned_role);
  RETURN NEW;
END;
$$;