-- AKUT-FIX: ue_missing_requirements() kastar "malformed array literal" i produktion för varje
-- UE vars pipeline_status inte är 'aktiv' (dvs. alla 99 importerade, som ligger på 'hittad').
-- Bekräftat live 2026-09-27 via två oberoende RPC-anrop mot produktionsdatabasen.
--
-- Orsak: `m := m || 'text'` (text[] || okänd-typad textliteral) är en känd PL/pgSQL-fälla.
-- Postgres kan behöva välja mellan operatorerna `anyarray || anyelement` och `anyarray || anyarray`,
-- och PL/pgSQL cachar planen för varje enskilt uttryck vid FÖRSTA körningen i en session/anslutning.
-- Om den då råkar välja array||array-tolkningen försöker den parsa 'text' som en array-literal,
-- vilket ger just felet "malformed array literal". Detta drabbar bara vissa rader (däribland
-- 'status', som är den FÖRSTA raden som faktiskt kördes för en aktiv, icke-'aktiv'-status-UE).
--
-- Fix: byt alla `m := m || 'x'` mot `m := array_append(m, 'x')`, som är entydigt och aldrig kan
-- tolkas som en array-literal. Funktionsbodyn är i övrigt oförändrad mot 20260927140000.
-- Kräver att 20260927140000_ue_payment_gate.sql redan är körd. Rollback: kör om 140000-filens
-- CREATE OR REPLACE (återställer samma, trasiga `||`-variant).

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

  IF NOT s.active THEN m := array_append(m, 'aktiv'); END IF;
  -- Aktiv: fritt. Provjobb: högst ett pågående jobb (inget annat med status <> 'klar').
  -- Övriga statusar (inkl. 'nej') får inga jobb.
  IF s.pipeline_status = 'provjobb' THEN
    IF EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.status <> 'klar'::public.job_status
        AND (_except_job IS NULL OR j.id <> _except_job)
        AND (j.subcontractor_id = s.id OR (s.user_id IS NOT NULL AND j.assigned_to = s.user_id))
    ) THEN
      m := array_append(m, 'provjobb_pagar');
    END IF;
  ELSIF s.pipeline_status <> 'aktiv' THEN
    m := array_append(m, 'status');
  END IF;
  IF s.user_id IS NULL THEN m := array_append(m, 'inloggning'); END IF;
  IF NOT s.f_skatt OR s.f_skatt_checked_at IS NULL OR s.f_skatt_checked_at < current_date - max_age THEN
    m := array_append(m, 'f_skatt');
  END IF;
  IF s.insurance_expires_at IS NULL OR s.insurance_expires_at < current_date THEN m := array_append(m, 'forsakring'); END IF;
  IF s.agreement_signed_at IS NULL THEN m := array_append(m, 'avtal'); END IF;
  IF s.id06_valid_until IS NULL OR s.id06_valid_until < current_date THEN m := array_append(m, 'id06'); END IF;
  IF s.is_posted_worker AND (s.a1_valid_until IS NULL OR s.a1_valid_until < current_date) THEN m := array_append(m, 'a1'); END IF;
  IF s.is_posted_worker AND s.posting_notified_at IS NULL THEN m := array_append(m, 'utstationering_anmalan'); END IF;
  IF COALESCE(s.kronofogden_debt, 0) > max_debt THEN m := array_append(m, 'kronofogden'); END IF;
  IF s.tax_certificate_checked_at IS NULL
     OR s.tax_certificate_checked_at < current_date - COALESCE((cfg ->> 'tax_certificate_max_age_days')::int, 30) THEN
    m := array_append(m, 'skatteverket_intyg');
  END IF;
  IF COALESCE((cfg ->> 'require_monthly_proof')::boolean, true)
     AND EXISTS (
       SELECT 1 FROM public.jobs j
       WHERE (j.subcontractor_id = s.id OR (s.user_id IS NOT NULL AND j.assigned_to = s.user_id))
         AND j.created_at < date_trunc('month', now())
     )
     AND (s.payroll_proof_month IS NULL OR s.payroll_proof_month < (date_trunc('month', now()) - interval '1 month')::date) THEN
    m := array_append(m, 'manadsintyg');
  END IF;
  RETURN m;
END $$;
