-- Vidars beslut 2026-09-28 (avtal v2.1), spec från Agent - Jurist (kopia Driftchefen/
-- Projektledaren), relaterad även av Agent - UE. GODKÄND av Projektledaren för ikvällens
-- deploybatch, sist efter 400000.
--
-- 1) Kronofogdskravet är helt borttaget ur avtalet och Bilaga 5 - Vidar kontrollerar själv hos
--    Kronofogden innan en UE tas in. Jurist gav explicit valet "stängas av ELLER tas bort" -
--    tas bort helt här (enklare, kräver ingen ny config-nyckel).
-- 2) Månadsintyg: INTE borttaget ur koden - stängs av via det redan befintliga
--    ue_requirements_config.require_monthly_proof (fanns redan i 20260927140000, defaultade
--    till true om nyckeln saknas). Går att slå på igen utan ny migration.
-- 3) Skatteverkets intyg krävs bara EN GÅNG, före första jobbet (Bilaga 5 A v2.1) - ingen
--    löpande 30-dagarskontroll vid varje tilldelning. Byt till en ren NULL-kontroll.
-- f_skatt/f_skatt_checked_at, försäkring, avtal, id06, a1, utstationering_anmalan, status och
-- provjobb_pagar är OFÖRÄNDRADE - inget i v2.1 rör dem.
CREATE OR REPLACE FUNCTION public.ue_missing_requirements(_sub uuid, _except_job uuid DEFAULT NULL)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  s public.subcontractors%ROWTYPE; m text[] := '{}'; cfg jsonb;
  max_age int;
BEGIN
  SELECT * INTO s FROM public.subcontractors WHERE id = _sub;
  IF NOT FOUND THEN RETURN ARRAY['registerpost']; END IF;
  SELECT value INTO cfg FROM public.app_settings WHERE key = 'ue_requirements_config';
  max_age := COALESCE((cfg ->> 'f_skatt_max_age_days')::int, 30);

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
  -- v2.1: bara EN GÅNG före första jobbet, ingen löpande 30-dagarskontroll.
  IF s.tax_certificate_checked_at IS NULL THEN
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

-- Stäng av kronofogd-gränsen (borttagen ur koden ovan) och månadsintyget (kvar i koden,
-- avstängt här).
UPDATE public.app_settings
SET value = (value - 'max_kronofogden_debt') || jsonb_build_object('require_monthly_proof', false)
WHERE key = 'ue_requirements_config';

-- Standardvärden för arbetsorderns villkorsfält, nu beslutade (avtal v2.1). retention_pct/
-- retention_days null = ingen innehållen betalning, termsLines() (work-order.ts) döljer redan
-- den raden villkorligt när de är null. bas_u är en beskrivande standardtext (Jurist
-- 2026-09-28) - sätts om per arbetsorder när en namngiven BAS-U-person finns.
UPDATE public.app_settings
SET value = value || jsonb_build_object(
  'liquidated_damages', jsonb_build_object('per_day', 1500, 'cap_pct', 10),
  'payment', jsonb_build_object('days', 30, 'retention_pct', null, 'retention_days', null),
  'client_org_number', '559539-3595',
  'framework_url', null,
  'bas_p', 'VT6 Invest AB',
  'bas_u', 'UE:s arbetsledare (med BAS-U-utbildning), annars VT6 Invest AB'
)
WHERE key = 'ue_work_order_defaults';
