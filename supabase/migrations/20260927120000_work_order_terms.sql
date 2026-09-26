-- Arbetsorder v2 (Agent - UE:s mall): slutdatum, arbetsordernummer AO-ÅÅÅÅ-NNNN, bindande accept med
-- personal på plats, sparad accepterad PDF, samt standardvärden för villkorsfälten.
-- Rör bara work_orders / work_order_offers / app_settings (skapade i 20260927100000_ue_package1.sql,
-- som måste vara körd först). Rollback: ALTER TABLE ... DROP COLUMN, DROP TRIGGER/FUNCTION/TABLE nedan.

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS accepted_by text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS personnel jsonb,
  ADD COLUMN IF NOT EXISTS accepted_pdf_path text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_work_orders_order_number ON public.work_orders(order_number) WHERE order_number IS NOT NULL;

ALTER TABLE public.work_order_offers
  ADD COLUMN IF NOT EXISTS accepted_by text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS personnel jsonb;

-- Löpnummer per år: AO-2026-0001, AO-2026-0002 ...
CREATE TABLE IF NOT EXISTS public.work_order_counters (
  year integer PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0
);
ALTER TABLE public.work_order_counters ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.work_order_counters TO service_role;

CREATE OR REPLACE FUNCTION public.assign_work_order_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE y integer := EXTRACT(YEAR FROM now() AT TIME ZONE 'Europe/Stockholm')::integer; n integer;
BEGIN
  IF NEW.order_number IS NULL THEN
    INSERT INTO public.work_order_counters (year, last_number) VALUES (y, 1)
    ON CONFLICT (year) DO UPDATE SET last_number = public.work_order_counters.last_number + 1
    RETURNING last_number INTO n;
    NEW.order_number := 'AO-' || y || '-' || lpad(n::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assign_work_order_number ON public.work_orders;
CREATE TRIGGER trg_assign_work_order_number
  BEFORE INSERT ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.assign_work_order_number();

-- Standardvärden för villkorsfälten. null = "enligt ramavtalet" i texterna. Vidar bestämmer värdena:
-- vite (kr per arbetsdag och högsta % av priset), betalningstid, innehåll (10 % i 30 dagar är utkastets förslag),
-- VT6 Invest AB:s org.nr (visas i sidfot), länk till ramavtalet och ev. standard-BAS.
INSERT INTO public.app_settings (key, value)
VALUES ('ue_work_order_defaults', '{
  "liquidated_damages": {"per_day": null, "cap_pct": null},
  "payment": {"days": null, "retention_pct": 10, "retention_days": 30},
  "client_org_number": null,
  "framework_url": null,
  "bas_p": null,
  "bas_u": null
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
