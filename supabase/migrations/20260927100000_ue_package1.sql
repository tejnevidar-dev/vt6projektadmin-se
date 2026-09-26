-- UE-paket 1: automatisk arbetsorder, utskick + digital accept, spärr för UE-krav, UE-vy.
-- Oberoende av migrationerna 20260927090000-090200 (rör inte deras tabeller/policyer).
-- Rollback: DROP TABLE work_order_offers, work_orders; DROP TRIGGER/FUNCTION nedan; de nya
-- kolumnerna på subcontractors kan ligga kvar.

-- ---------- UE-krav: nya fält på subcontractors ----------
-- Följer stopplistan i ledning/ue/02-dokumentchecklista.md §4 och pipelinen Hittad -> Aktiv.
ALTER TABLE public.subcontractors
  ADD COLUMN IF NOT EXISTS id06_number text,
  ADD COLUMN IF NOT EXISTS id06_valid_until date,
  ADD COLUMN IF NOT EXISTS is_posted_worker boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS a1_valid_until date,
  ADD COLUMN IF NOT EXISTS posting_notified_at date,
  ADD COLUMN IF NOT EXISTS f_skatt_checked_at date,
  ADD COLUMN IF NOT EXISTS kronofogden_debt numeric(12,2),
  ADD COLUMN IF NOT EXISTS pipeline_status text NOT NULL DEFAULT 'hittad'
    CHECK (pipeline_status IN ('hittad', 'kontaktad', 'samtal', 'kvalificerad', 'provjobb', 'aktiv')),
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100;

-- Gränser ändras utan ny migration (standard: F-skattekontroll max 30 dagar gammal, skuld max 10 000 kr).
INSERT INTO public.app_settings (key, value)
VALUES ('ue_requirements_config', '{"f_skatt_max_age_days": 30, "max_kronofogden_debt": 10000}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Lista på det som saknas för att en UE ska få tilldelas jobb (tom lista = godkänd).
-- Bara pipelinestatus 'aktiv' och komplett stopplista får arbetsorder.
CREATE OR REPLACE FUNCTION public.ue_missing_requirements(_sub uuid)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s public.subcontractors%ROWTYPE; m text[] := '{}'; cfg jsonb;
  max_age int; max_debt numeric;
BEGIN
  SELECT * INTO s FROM public.subcontractors WHERE id = _sub;
  IF NOT FOUND THEN RETURN ARRAY['registerpost']; END IF;
  SELECT value INTO cfg FROM public.app_settings WHERE key = 'ue_requirements_config';
  max_age := COALESCE((cfg ->> 'f_skatt_max_age_days')::int, 30);
  max_debt := COALESCE((cfg ->> 'max_kronofogden_debt')::numeric, 10000);

  IF NOT s.active THEN m := m || 'aktiv'; END IF;
  IF s.pipeline_status <> 'aktiv' THEN m := m || 'status'; END IF;
  IF s.user_id IS NULL THEN m := m || 'inloggning'; END IF;
  IF NOT s.f_skatt OR s.f_skatt_checked_at IS NULL OR s.f_skatt_checked_at < current_date - max_age THEN
    m := m || 'f_skatt';
  END IF;
  IF s.insurance_expires_at IS NULL OR s.insurance_expires_at < current_date THEN m := m || 'forsakring'; END IF;
  IF s.agreement_signed_at IS NULL THEN m := m || 'avtal'; END IF;
  IF s.id06_valid_until IS NULL OR s.id06_valid_until < current_date THEN m := m || 'id06'; END IF;
  IF s.is_posted_worker AND (s.a1_valid_until IS NULL OR s.a1_valid_until < current_date) THEN m := m || 'a1'; END IF;
  IF s.is_posted_worker AND s.posting_notified_at IS NULL THEN m := m || 'utstationering_anmalan'; END IF;
  IF COALESCE(s.kronofogden_debt, 0) > max_debt THEN m := m || 'kronofogden'; END IF;
  RETURN m;
END $$;
GRANT EXECUTE ON FUNCTION public.ue_missing_requirements(uuid) TO authenticated, service_role;

-- Spärr: ett jobb kan inte tilldelas en UE som saknar något krav.
CREATE OR REPLACE FUNCTION public.enforce_ue_requirements()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE sub uuid; missing text[];
BEGIN
  IF NEW.assignment_type IS DISTINCT FROM 'underentreprenor'::public.job_assignment_type THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to
     AND NEW.subcontractor_id IS NOT DISTINCT FROM OLD.subcontractor_id
     AND OLD.assignment_type IS NOT DISTINCT FROM NEW.assignment_type THEN
    RETURN NEW;
  END IF;
  IF NEW.assigned_to IS NULL AND NEW.subcontractor_id IS NULL THEN RETURN NEW; END IF;
  sub := NEW.subcontractor_id;
  IF sub IS NULL THEN
    SELECT id INTO sub FROM public.subcontractors WHERE user_id = NEW.assigned_to;
  END IF;
  IF sub IS NULL THEN
    RAISE EXCEPTION 'UE_KRAV: underentreprenoren saknar registerpost' USING ERRCODE = 'P0001';
  END IF;
  missing := public.ue_missing_requirements(sub);
  IF array_length(missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'UE_KRAV: underentreprenoren saknar: %', array_to_string(missing, ', ') USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_ue_requirements ON public.jobs;
CREATE TRIGGER trg_enforce_ue_requirements
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ue_requirements();

-- Ett UE-jobb kan inte markeras klart utan före- och efterfoton och en slutförd egenkontroll.
-- Admin och servern (auth.uid() null) undantas.
CREATE OR REPLACE FUNCTION public.enforce_ue_job_completion()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'klar'::public.job_status AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.assignment_type = 'underentreprenor'::public.job_assignment_type
     AND auth.uid() IS NOT NULL
     AND NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    IF NOT EXISTS (SELECT 1 FROM public.job_photos WHERE job_id = NEW.id AND phase = 'fore') THEN
      RAISE EXCEPTION 'KLART_KRAV: minst ett foto fore arbetet kravs' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.job_photos WHERE job_id = NEW.id AND phase = 'efter') THEN
      RAISE EXCEPTION 'KLART_KRAV: minst ett foto efter arbetet kravs' USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.self_checks WHERE job_id = NEW.id AND completed_at IS NOT NULL) THEN
      RAISE EXCEPTION 'KLART_KRAV: en slutford egenkontroll kravs' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_ue_job_completion ON public.jobs;
CREATE TRIGGER trg_enforce_ue_job_completion
  BEFORE UPDATE OF status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ue_job_completion();

-- ---------- Arbetsorder ----------
CREATE TABLE IF NOT EXISTS public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'offered', 'accepted', 'unassigned', 'cancelled')),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  ue_price numeric(12,2),
  start_date date,
  accepted_subcontractor_id uuid REFERENCES public.subcontractors(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Högst en aktiv arbetsorder per lead.
CREATE UNIQUE INDEX IF NOT EXISTS uq_work_orders_active_lead ON public.work_orders(lead_id) WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON public.work_orders(status);

CREATE TABLE IF NOT EXISTS public.work_order_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  subcontractor_id uuid NOT NULL REFERENCES public.subcontractors(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  fixed_price numeric(12,2) NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  responded_at timestamptz,
  decline_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wo_offers_wo ON public.work_order_offers(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_offers_sub ON public.work_order_offers(subcontractor_id, status);

GRANT SELECT ON public.work_orders, public.work_order_offers TO authenticated;
GRANT ALL ON public.work_orders, public.work_order_offers TO service_role;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_offers ENABLE ROW LEVEL SECURITY;

-- Skrivning sker bara via servern (service role) och admin. UE och säljare kan bara läsa.
CREATE POLICY "Admin manages work orders" ON public.work_orders
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "UE reads work orders offered to them" ON public.work_orders
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.work_order_offers o
    WHERE o.work_order_id = work_orders.id AND public.owns_subcontractor(o.subcontractor_id)
  ));

CREATE POLICY "Seller reads work orders for own leads" ON public.work_orders
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = work_orders.lead_id AND (l.seller_id = auth.uid() OR l.created_by = auth.uid())
  ));

CREATE POLICY "Admin manages work order offers" ON public.work_order_offers
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "UE reads own work order offers" ON public.work_order_offers
  FOR SELECT TO authenticated
  USING (public.owns_subcontractor(subcontractor_id));

CREATE TRIGGER trg_work_orders_updated_at
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Svarstid för UE-accept (timmar) och tillåtna tider styrs härifrån; ändra utan ny migration.
INSERT INTO public.app_settings (key, value)
VALUES ('ue_dispatch_config', '{"accept_hours": 24}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---------- ÄTA-begäran från UE ----------
-- UE får skapa ÄTA på sitt eget pågående jobb, alltid som "pending" (kräver admins godkännande).
CREATE POLICY "UE requests ata on own job" ON public.atas
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND approval_status = 'pending'
    AND private.has_role(auth.uid(), 'underentreprenor'::public.app_role)
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = atas.job_id
        AND j.assigned_to = auth.uid()
        AND j.assignment_type = 'underentreprenor'::public.job_assignment_type
        AND j.status = 'pagaende'::public.job_status
    )
  );
