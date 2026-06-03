GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_adjustments TO authenticated;
GRANT ALL ON public.salary_adjustments TO service_role;