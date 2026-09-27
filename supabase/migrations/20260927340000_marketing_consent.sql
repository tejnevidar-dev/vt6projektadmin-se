-- UTKAST - Agent - Innehålls förslag (se ledning/marknad/innehall/kalender.md rad 21,
-- "Samtyckesfält per jobb föreslaget till Agent - CRM för kommande jobb"), specificerat av
-- Agent - CRM. Skickas till Driftchefen för granskning INNAN den går vidare till Vidar
-- (avviker från normal migrationsgång enligt Driftchefens instruktion 2026-09-27).
--
-- Syfte: Vidar (eller säljaren vid bokning) registrerar kundens samtycke till att bilder från
-- jobbet får användas i marknadsföring (sociala medier, GBP, referenscase på sajten), och på
-- vilken detaljnivå. Idag finns det bara som fri text i fakta.md-filer utanför CRM (Blidö/Singö),
-- vilket inte skalar och inte går att kontrollera programmatiskt innan ett foto publiceras.
--
-- Additiv, ändrar inget befintligt beteende för andra kolumner. Inga nya RLS-policies (nya
-- kolumner täcks av befintliga policies på jobs/job_photos), MEN se kolumnspärren nedan:
-- "Owners update own jobs" (assigned_to = auth.uid()) och job_photos "FOR ALL"-policyn släpper
-- annars igenom UPDATE på VILKEN SOM HELST kolumn för en arbetsledare/UE som äger jobbet - alltså
-- även de nya samtyckesfälten. Bara admin och säljare ska kunna sätta samtycke (Driftchefens
-- fråga 2026-09-27), så en BEFORE UPDATE-trigger låser dem, samma mönster som
-- lock_arbetsledare_ata_fields() för atas.
--
-- Ingen automatisk gallring/radering ingår - det är en egen, separat leverans om/när det behövs
-- (jfr lönebevis-gallring, samma resonemang).

CREATE TYPE public.marketing_consent_status AS ENUM ('ej_fragat', 'ja_utan_adress', 'ja_med_ort', 'nej');

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS marketing_consent public.marketing_consent_status NOT NULL DEFAULT 'ej_fragat',
  ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_consent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Fri text (kort): t.ex. "muntligt vid bokning", "skriftligt i mejl", "ramavtal/kundavtal p. X".
  -- Ingen egen lista än - för få riktiga fall (2 st) för att veta vilka källor som faktiskt
  -- förekommer. Byt till CHECK-begränsad enum när mönstret är tydligare.
  ADD COLUMN IF NOT EXISTS marketing_consent_source text;

COMMENT ON COLUMN public.jobs.marketing_consent IS
  'Kundens samtycke till marknadsföring av bilder från jobbet. ej_fragat = ej tillfrågad (default,
   INGA bilder får användas). ja_utan_adress = får användas men utan adress/synligt husnummer.
   ja_med_ort = får användas och orten (t.ex. "Norrtälje") får nämnas. nej = får aldrig användas.';

-- Per-foto-undantag: NULL ärver jobbets marketing_consent. FALSE utesluter just detta foto även
-- om jobbet har samtycke (t.ex. ett ansikte eller en skylt syns trots allt). Sätter ALDRIG ett
-- foto till tillåtet om jobbets samtycke är 'ej_fragat' eller 'nej' - det kontrolleras av den
-- som väljer bilder för marknadsföring, inte av databasen.
ALTER TABLE public.job_photos
  ADD COLUMN IF NOT EXISTS marketing_ok boolean;
COMMENT ON COLUMN public.job_photos.marketing_ok IS
  'NULL = ärver jobbets marketing_consent. FALSE = uteslut just detta foto (t.ex. ansikte/skylt
   synligt) även om jobbet har samtycke. Sätts aldrig till TRUE för att kringgå ett jobb utan
   samtycke - den kontrollen görs av den som väljer bilder, inte av ett schema-villkor här.';

-- ===== Kolumnspärr: bara admin/säljare får sätta samtycke =====
CREATE OR REPLACE FUNCTION public.lock_marketing_consent_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF private.has_role(auth.uid(), 'admin'::app_role)
     OR private.has_role(auth.uid(), 'saljare'::app_role) THEN
    RETURN NEW;
  END IF;

  IF OLD.marketing_consent IS DISTINCT FROM NEW.marketing_consent
     OR OLD.marketing_consent_at IS DISTINCT FROM NEW.marketing_consent_at
     OR OLD.marketing_consent_by IS DISTINCT FROM NEW.marketing_consent_by
     OR OLD.marketing_consent_source IS DISTINCT FROM NEW.marketing_consent_source THEN
    RAISE EXCEPTION 'Bara admin eller säljare får ändra kundens marknadsföringssamtycke.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_marketing_consent_fields ON public.jobs;
CREATE TRIGGER trg_lock_marketing_consent_fields
BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.lock_marketing_consent_fields();

-- job_photos "Manage photos for accessible jobs" är FOR ALL (täcker INSERT också), så en
-- arbetsledare/UE kan annars INSERT:a ett nytt foto med marketing_ok redan satt - inte bara
-- UPDATE:a ett befintligt. Spärren måste därför gälla BEFORE INSERT OR UPDATE (Driftchefens
-- fråga 2026-09-27): vid INSERT från icke admin/säljare krävs marketing_ok IS NULL, vid UPDATE
-- får värdet inte ändras alls. jobs saknar en motsvarande INSERT-policy för icke-admin (jobs
-- skapas bara via triggern handle_lead_booking, SECURITY DEFINER, som kringgår RLS helt), så
-- lock_marketing_consent_fields ovan behöver inte samma BEFORE INSERT-gren.
CREATE OR REPLACE FUNCTION public.lock_marketing_ok_field()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF private.has_role(auth.uid(), 'admin'::app_role)
     OR private.has_role(auth.uid(), 'saljare'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.marketing_ok IS NOT NULL THEN
      RAISE EXCEPTION 'Bara admin eller säljare får sätta marketing_ok på ett jobbfoto.';
    END IF;
  ELSIF OLD.marketing_ok IS DISTINCT FROM NEW.marketing_ok THEN
    RAISE EXCEPTION 'Bara admin eller säljare får ändra marketing_ok på ett jobbfoto.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_marketing_ok_field ON public.job_photos;
CREATE TRIGGER trg_lock_marketing_ok_field
BEFORE INSERT OR UPDATE ON public.job_photos
FOR EACH ROW EXECUTE FUNCTION public.lock_marketing_ok_field();
