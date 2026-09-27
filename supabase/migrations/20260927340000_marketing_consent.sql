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
-- Additiv, ändrar inget befintligt beteende och inga RLS-regler (nya kolumner täcks av
-- befintliga policies på jobs/job_photos). Ingen automatisk gallring/radering ingår - det är en
-- egen, separat leverans om/när det behövs (jfr lönebevis-gallring, samma resonemang).

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
