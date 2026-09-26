-- Riktat utskick av arbetsorder: arbetsordern går först till vald UE (t.ex. ett provjobb) och först vid avböjt eller
-- uteblivet svar vidare i vanlig turordning. Kräver 20260927100000_ue_package1.sql. Rollback: DROP COLUMN.
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS preferred_subcontractor_id uuid REFERENCES public.subcontractors(id) ON DELETE SET NULL;
