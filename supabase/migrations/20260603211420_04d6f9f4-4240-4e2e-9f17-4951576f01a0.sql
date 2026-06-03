GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;

DROP POLICY IF EXISTS "Admins manage all employees" ON public.employees;
CREATE POLICY "Admins manage all employees" ON public.employees
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage salary adjustments" ON public.salary_adjustments;
CREATE POLICY "Admins manage salary adjustments" ON public.salary_adjustments
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage instructions" ON public.self_check_instructions;
CREATE POLICY "Admins manage instructions" ON public.self_check_instructions
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));