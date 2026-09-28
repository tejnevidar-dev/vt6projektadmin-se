-- Jurist-granskning UE-avtal v2.0, avsnitt 6 punkt 8b (ledning/ue/avtal/jurist-granskning.md):
-- F-skattekontrollen ska vara aktuell (max f_skatt_max_age_days, idag 30) inte bara vid
-- tilldelning (public.ue_missing_requirements, redan klart) utan ÄVEN vid godkännande/betalning
-- av en UE-faktura. Skälet är R2 (falska egenföretagare): betalas ut utan aktuell
-- F-skattekontroll saknas skatteavdragsskyldigheten (SFL 10 kap. 11 §) som annars täcker det
-- läget. Kräver 20260927140000_ue_payment_gate.sql (samma trigger-funktion, samma
-- app_settings-nyckel ue_requirements_config).
--
-- UPPDATERAD innan körning (Vidars beslut 2026-09-28, avtal v2.1, via Agent - UE): INGEN
-- innehållen betalning och INGA lönebevis krävs längre före betalning - hela beloppet betalas
-- 30 dagar efter godkänd slutkontroll och korrekt faktura. Ursprungsversionen av den här filen
-- (som aldrig hann köras i produktion) krävde ett lönebevis-dokument innan godkännande/betalning
-- - det kravet är borttaget här. F-skattekontrollen kvarstår oförändrad (skild fråga, R2 gäller
-- fortfarande).
CREATE OR REPLACE FUNCTION public.enforce_payroll_proof_on_invoice()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  s public.subcontractors%ROWTYPE;
  cfg jsonb;
  max_age int;
BEGIN
  IF NEW.status IN ('godkand', 'betald') AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.subcontractor_id IS NOT NULL THEN
      SELECT * INTO s FROM public.subcontractors WHERE id = NEW.subcontractor_id;
      SELECT value INTO cfg FROM public.app_settings WHERE key = 'ue_requirements_config';
      max_age := COALESCE((cfg ->> 'f_skatt_max_age_days')::int, 30);
      IF FOUND AND (NOT s.f_skatt OR s.f_skatt_checked_at IS NULL OR s.f_skatt_checked_at < current_date - max_age) THEN
        RAISE EXCEPTION 'FSKATT_KRAV: fakturan kan inte godkannas eller betalas utan aktuell F-skattekontroll (max % dagar, jurist R2)', max_age USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
