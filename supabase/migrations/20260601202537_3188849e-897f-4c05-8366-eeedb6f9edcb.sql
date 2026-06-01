
-- 2. Hjälpfunktioner för intern/extern uppdelning
CREATE OR REPLACE FUNCTION public.is_internal_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','arbetsledare','hantverkare','underentreprenor')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_external_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','saljare')
  )
$$;

-- 3. Personal-tabell
CREATE TYPE public.employment_type AS ENUM ('timanstalld','fast','underentreprenor');

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  full_name text NOT NULL,
  email text,
  phone text,
  personal_number text,
  employment_type public.employment_type NOT NULL DEFAULT 'timanstalld',
  hourly_rate numeric(10,2),
  monthly_salary numeric(10,2),
  company_name text,
  org_number text,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all employees"
ON public.employees FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees see own row"
ON public.employees FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Lönejusteringar (engångsposter)
CREATE TYPE public.salary_adjustment_type AS ENUM ('tillagg','avdrag');

CREATE TABLE public.salary_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type public.salary_adjustment_type NOT NULL,
  amount numeric(10,2) NOT NULL,
  reason text NOT NULL,
  period_month date NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_adjustments TO authenticated;
GRANT ALL ON public.salary_adjustments TO service_role;

ALTER TABLE public.salary_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage salary adjustments"
ON public.salary_adjustments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Employees see own adjustments"
ON public.salary_adjustments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.id = employee_id AND e.user_id = auth.uid()
  )
);
