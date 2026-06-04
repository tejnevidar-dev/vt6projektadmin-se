
-- Move helper functions into private schema
CREATE OR REPLACE FUNCTION private.is_job_member(_job_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.job_members WHERE job_id=_job_id AND user_id=_user_id)
$$;

CREATE OR REPLACE FUNCTION private.is_job_owner(_job_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.jobs WHERE id=_job_id AND assigned_to=_user_id)
$$;

CREATE OR REPLACE FUNCTION private.is_external_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('admin','saljare'))
$$;

CREATE OR REPLACE FUNCTION private.is_internal_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('admin','arbetsledare','hantverkare','underentreprenor'))
$$;

GRANT EXECUTE ON FUNCTION private.is_job_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_job_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_external_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_internal_user(uuid) TO authenticated;

-- Recreate policies referring to these functions
DROP POLICY IF EXISTS "Members see jobs they belong to" ON public.jobs;
CREATE POLICY "Members see jobs they belong to" ON public.jobs
  FOR SELECT TO authenticated USING (private.is_job_member(id, auth.uid()));

DROP POLICY IF EXISTS "Job owners manage members" ON public.job_members;
CREATE POLICY "Job owners manage members" ON public.job_members
  FOR ALL TO authenticated
  USING (private.is_job_owner(job_id, auth.uid()))
  WITH CHECK (private.is_job_owner(job_id, auth.uid()));

DROP POLICY IF EXISTS "Users insert own time entries" ON public.time_entries;
CREATE POLICY "Users insert own time entries" ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()) AND (private.is_job_owner(job_id, auth.uid()) OR private.is_job_member(job_id, auth.uid())));

DROP POLICY IF EXISTS "Job owners see job time entries" ON public.time_entries;
CREATE POLICY "Job owners see job time entries" ON public.time_entries
  FOR SELECT TO authenticated USING (private.is_job_owner(job_id, auth.uid()));

DROP POLICY IF EXISTS "Job owners approve time entries" ON public.time_entries;
CREATE POLICY "Job owners approve time entries" ON public.time_entries
  FOR UPDATE TO authenticated
  USING (private.is_job_owner(job_id, auth.uid()))
  WITH CHECK (private.is_job_owner(job_id, auth.uid()));

DROP POLICY IF EXISTS "Users manage own self checks" ON public.self_checks;
CREATE POLICY "Users manage own self checks" ON public.self_checks
  FOR ALL TO authenticated
  USING ((user_id = auth.uid()) AND (private.is_job_owner(job_id, auth.uid()) OR private.is_job_member(job_id, auth.uid())))
  WITH CHECK ((user_id = auth.uid()) AND (private.is_job_owner(job_id, auth.uid()) OR private.is_job_member(job_id, auth.uid())));

DROP POLICY IF EXISTS "Job owners see job self checks" ON public.self_checks;
CREATE POLICY "Job owners see job self checks" ON public.self_checks
  FOR SELECT TO authenticated USING (private.is_job_owner(job_id, auth.uid()));

-- Storage policies
DROP POLICY IF EXISTS "Work orders readable by job participants" ON storage.objects;
CREATE POLICY "Work orders readable by job participants" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'work-orders'
    AND (private.has_role(auth.uid(), 'admin'::public.app_role)
         OR private.is_job_owner((split_part(name, '/', 1))::uuid, auth.uid())
         OR private.is_job_member((split_part(name, '/', 1))::uuid, auth.uid()))
  );

DROP POLICY IF EXISTS "Work orders uploadable by admin or owner" ON storage.objects;
CREATE POLICY "Work orders uploadable by admin or owner" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'work-orders'
    AND (private.has_role(auth.uid(), 'admin'::public.app_role)
         OR private.is_job_owner((split_part(name, '/', 1))::uuid, auth.uid()))
  );

DROP POLICY IF EXISTS "Work orders deletable by admin or owner" ON storage.objects;
CREATE POLICY "Work orders deletable by admin or owner" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'work-orders'
    AND (private.has_role(auth.uid(), 'admin'::public.app_role)
         OR private.is_job_owner((split_part(name, '/', 1))::uuid, auth.uid()))
  );

DROP POLICY IF EXISTS "Users can read self-check images they have job access to" ON storage.objects;
CREATE POLICY "Users can read self-check images they have job access to" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'self-check-images'
    AND (private.has_role(auth.uid(), 'admin'::public.app_role)
         OR private.is_job_owner(((storage.foldername(name))[1])::uuid, auth.uid())
         OR private.is_job_member(((storage.foldername(name))[1])::uuid, auth.uid()))
  );

DROP POLICY IF EXISTS "Users can upload self-check images for jobs they belong to" ON storage.objects;
CREATE POLICY "Users can upload self-check images for jobs they belong to" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'self-check-images'
    AND (private.has_role(auth.uid(), 'admin'::public.app_role)
         OR private.is_job_owner(((storage.foldername(name))[1])::uuid, auth.uid())
         OR private.is_job_member(((storage.foldername(name))[1])::uuid, auth.uid()))
  );

DROP POLICY IF EXISTS "Users can delete self-check images for jobs they belong to" ON storage.objects;
CREATE POLICY "Users can delete self-check images for jobs they belong to" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'self-check-images'
    AND (private.has_role(auth.uid(), 'admin'::public.app_role)
         OR private.is_job_owner(((storage.foldername(name))[1])::uuid, auth.uid())
         OR private.is_job_member(((storage.foldername(name))[1])::uuid, auth.uid()))
  );

-- Drop the public copies
DROP FUNCTION IF EXISTS public.is_job_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_job_owner(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_external_user(uuid);
DROP FUNCTION IF EXISTS public.is_internal_user(uuid);
