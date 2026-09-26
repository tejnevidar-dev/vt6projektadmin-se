-- UE-paket 2, del 1 (Agent - UE): betalningsspärr med lönebevis, Skatteverkets intyg och månadsintyg,
-- samt fotofasen 'dagslut' (foto på tätat tak varje kväll). Kräver 20260927100000_ue_package1.sql.
-- Rollback: DROP TRIGGER trg_enforce_payroll_proof_on_invoice; återställ ue_missing_requirements från fil 4.

ALTER TABLE public.subcontractors
  ADD COLUMN IF NOT EXISTS tax_certificate_checked_at date,
  ADD COLUMN IF NOT EXISTS payroll_proof_month date;

-- Dokument kan kopplas till en UE-faktura (lönebevis) och gälla en period (månad).
ALTER TABLE public.subcontractor_documents
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.subcontractor_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS period date;
CREATE INDEX IF NOT EXISTS idx_sc_documents_invoice ON public.subcontractor_documents(invoice_id);

-- Gränser i app_settings (befintliga värden behålls).
UPDATE public.app_settings
SET value = jsonb_build_object('tax_certificate_max_age_days', 30, 'require_monthly_proof', true) || value
WHERE key = 'ue_requirements_config';

CREATE OR REPLACE FUNCTION public.ue_missing_requirements(_sub uuid, _except_job uuid DEFAULT NULL)
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
  -- Aktiv: fritt. Provjobb: högst ett pågående jobb (inget annat med status <> 'klar').
  -- Övriga statusar (inkl. 'nej') får inga jobb.
  IF s.pipeline_status = 'provjobb' THEN
    IF EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.status <> 'klar'::public.job_status
        AND (_except_job IS NULL OR j.id <> _except_job)
        AND (j.subcontractor_id = s.id OR (s.user_id IS NOT NULL AND j.assigned_to = s.user_id))
    ) THEN
      m := m || 'provjobb_pagar';
    END IF;
  ELSIF s.pipeline_status <> 'aktiv' THEN
    m := m || 'status';
  END IF;
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
  -- UE-paket 2 (Bilaga 5): Skatteverkets intyg (max ålder ur config) och månadsintyg för förra månaden.
  IF s.tax_certificate_checked_at IS NULL
     OR s.tax_certificate_checked_at < current_date - COALESCE((cfg ->> 'tax_certificate_max_age_days')::int, 30) THEN
    m := m || 'skatteverket_intyg';
  END IF;
  IF COALESCE((cfg ->> 'require_monthly_proof')::boolean, true)
     AND EXISTS (
       SELECT 1 FROM public.jobs j
       WHERE (j.subcontractor_id = s.id OR (s.user_id IS NOT NULL AND j.assigned_to = s.user_id))
         AND j.created_at < date_trunc('month', now())
     )
     AND (s.payroll_proof_month IS NULL OR s.payroll_proof_month < (date_trunc('month', now()) - interval '1 month')::date) THEN
    m := m || 'manadsintyg';
  END IF;
  RETURN m;
END $$;

-- En UE-faktura kan inte godkännas eller betalas utan minst ett lönebevis kopplat till fakturan
-- (Skatteverkets intyg, arbetsgivardeklaration/lönespecifikation och firmatecknarens försäkran, Bilaga 5).
CREATE OR REPLACE FUNCTION public.enforce_payroll_proof_on_invoice()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.status IN ('godkand', 'betald') AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.subcontractor_documents d
      WHERE d.invoice_id = NEW.id AND d.doc_type = 'lonebevis'
    ) THEN
      RAISE EXCEPTION 'LONEBEVIS_KRAV: fakturan kan inte godkannas eller betalas utan lonebevis (Bilaga 5)' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_payroll_proof_on_invoice ON public.subcontractor_invoices;
CREATE TRIGGER trg_enforce_payroll_proof_on_invoice
  BEFORE UPDATE OF status ON public.subcontractor_invoices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_payroll_proof_on_invoice();

-- Fotofas 'dagslut': foto på tätat tak varje kväll. (Publika galleriet visar bara före/efter.)
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.job_photos'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%phase%'
  LOOP
    EXECUTE format('ALTER TABLE public.job_photos DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE public.job_photos ADD CONSTRAINT job_photos_phase_check CHECK (phase IN ('fore', 'efter', 'dagslut'));
