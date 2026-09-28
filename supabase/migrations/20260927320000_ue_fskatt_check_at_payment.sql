-- Jurist-granskning UE-avtal v2.0, avsnitt 6 punkt 8b (ledning/ue/avtal/jurist-granskning.md):
-- F-skattekontrollen ska vara aktuell (max f_skatt_max_age_days, idag 30) inte bara vid
-- tilldelning (public.ue_missing_requirements, redan klart) utan ÄVEN vid godkännande/betalning
-- av en UE-faktura. Skälet är R2 (falska egenföretagare): betalas ut utan aktuell
-- F-skattekontroll saknas skatteavdragsskyldigheten (SFL 10 kap. 11 §) som annars täcker det
-- läget. Kräver 20260927140000_ue_payment_gate.sql (samma trigger-funktion, samma
-- app_settings-nyckel ue_requirements_config). F-skattkontrollen är PÅ - Bilaga 5 A (v2.1)
-- kräver den fortfarande före varje utbetalning.
--
-- UPPDATERAD innan körning (Vidars beslut 2026-09-28, avtal v2.1, spec från Agent - Jurist):
-- lönebevis-kravet ska gå att stänga av utan ny migration, inte tas bort ur koden - så att det
-- kan slås på igen om avtalet ändras tillbaka. Styrs av ue_requirements_config.require_payroll_proof
-- (default TRUE i koden om nyckeln saknas, men raden i app_settings nedan sätter den till FALSE
-- - dagens läge enligt v2.1: inget lönebevis krävs före betalning).
CREATE OR REPLACE FUNCTION public.enforce_payroll_proof_on_invoice()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  s public.subcontractors%ROWTYPE;
  cfg jsonb;
  max_age int;
BEGIN
  IF NEW.status IN ('godkand', 'betald') AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT value INTO cfg FROM public.app_settings WHERE key = 'ue_requirements_config';

    IF COALESCE((cfg ->> 'require_payroll_proof')::boolean, true) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.subcontractor_documents d
        WHERE d.invoice_id = NEW.id AND d.doc_type = 'lonebevis'
      ) THEN
        RAISE EXCEPTION 'LONEBEVIS_KRAV: fakturan kan inte godkannas eller betalas utan lonebevis (Bilaga 5)' USING ERRCODE = 'P0001';
      END IF;
    END IF;

    IF NEW.subcontractor_id IS NOT NULL THEN
      SELECT * INTO s FROM public.subcontractors WHERE id = NEW.subcontractor_id;
      max_age := COALESCE((cfg ->> 'f_skatt_max_age_days')::int, 30);
      IF FOUND AND (NOT s.f_skatt OR s.f_skatt_checked_at IS NULL OR s.f_skatt_checked_at < current_date - max_age) THEN
        RAISE EXCEPTION 'FSKATT_KRAV: fakturan kan inte godkannas eller betalas utan aktuell F-skattekontroll (max % dagar, jurist R2)', max_age USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

UPDATE public.app_settings
SET value = value || jsonb_build_object('require_payroll_proof', false)
WHERE key = 'ue_requirements_config';
