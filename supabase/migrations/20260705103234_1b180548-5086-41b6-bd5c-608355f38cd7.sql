ALTER TYPE public.employment_type ADD VALUE 'provisionsbaserad';
ALTER TABLE public.employees ADD COLUMN provision_rate numeric(10,2);
COMMENT ON COLUMN public.employees.provision_rate IS 'Provisionsprocent (%) för provisionsbaserade säljare';