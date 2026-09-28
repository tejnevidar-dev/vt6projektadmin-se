-- Vidars direktiv 2026-09-28 (kassamålet, via Driftchef): datamodell + endpoints för två nya
-- flöden från sajten. Spec avstämd med Agent - Marknadschef och Agent - Hemsida & SEO. Filen
-- körs INTE av den här agenten - Vidar kör den när Driftchefen sagt att den är redo.
--
-- 1) BOKA TAKKONTROLL: sajten skickar en bokningsförfrågan (dag+halvdag, eller "ring mig").
--    Skapar en lead (som webhooken) + en rad här. Inget mejl till kund härifrån - en
--    bekräftelse är en separat, senare admin-knapp som kräver Vidars OK.
-- 2) OMDÖMEN: efter betalt jobb (leads.customer_paid_at) flaggas leaden "redo" av en daglig
--    cron. Själva utskicket är en manuell knapp, avstängd tills Vidar godkänt mall-texten.

CREATE TYPE public.booking_slot AS ENUM ('formiddag', 'eftermiddag', 'ring_mig');

CREATE TABLE public.booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  slot public.booking_slot NOT NULL,
  -- NULL när slot = 'ring_mig' (inget datum att boka, bara en återringning).
  requested_date date,
  status text NOT NULL DEFAULT 'ny' CHECK (status IN ('ny', 'bekraftad', 'avbokad')),
  confirmed_date date,
  confirmed_slot public.booking_slot,
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  -- Annonsspårning från sajten, samma nycklar som GA4/Google Ads använder.
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- En öppen ("ny") bokningsförfrågan i taget per lead - nya försök innan dess går via
-- ingestLead()s vanliga dubblettmatchning (samma lead, ny anteckning) istället för en ny rad.
CREATE UNIQUE INDEX uq_booking_requests_open_per_lead ON public.booking_requests(lead_id) WHERE status = 'ny';
CREATE INDEX idx_booking_requests_lead ON public.booking_requests(lead_id);
CREATE INDEX idx_booking_requests_status_created ON public.booking_requests(status, created_at);

GRANT SELECT, INSERT, UPDATE ON public.booking_requests TO authenticated;
GRANT ALL ON public.booking_requests TO service_role;
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

-- Samma synlighetsmodell som leads: all personal (delad pool, ingen ägarspärr) - se
-- CLAUDE.md "seller_id är bara provisionstilldelning, ingen åtkomstspärr".
CREATE POLICY "Staff reads booking requests" ON public.booking_requests
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff updates booking requests" ON public.booking_requests
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
-- INSERT sker bara från den publika endpointen via service-role (anon/authenticated skapar
-- aldrig en bokningsrad direkt) - ingen INSERT-policy för authenticated här, medvetet.

CREATE TRIGGER update_booking_requests_updated_at
  BEFORE UPDATE ON public.booking_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SLA-gränser för bokningsflödet, konfigurerbara utan ny migration (samma mönster som
-- ue_requirements_config m.fl.).
INSERT INTO public.app_settings (key, value)
VALUES ('booking_sla_config', '{"callback_hours": 1, "confirm_hours": 2}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ===== Omdömesflöde =====
CREATE TYPE public.review_status AS ENUM ('ej_aktuellt', 'redo', 'skickad', 'mottagen', 'avbojd');

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS review_status public.review_status NOT NULL DEFAULT 'ej_aktuellt',
  ADD COLUMN IF NOT EXISTS review_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_received_at timestamptz,
  -- Sätts av personal om kunden bett att inte bli kontaktad om omdöme. Respekteras av cronen
  -- som flaggar "redo" - en lead med opt_out flaggas aldrig, oavsett customer_paid_at.
  ADD COLUMN IF NOT EXISTS review_opt_out boolean NOT NULL DEFAULT false;

-- review_request_template: NULL tills Innehåll skrivit utkastet och Vidar godkänt det (samma
-- säkerhetsmönster som customer_terms - "Skicka omdömesförfrågan"-knappen vägrar om det är
-- tomt). google_review_url: länken till RoslagsTaks Google-recensionssida. delay_days: hur
-- många dagar efter customer_paid_at en lead flaggas "redo" (förslag 3, avstämt med
-- Marknadschef, ändras utan ny migration).
INSERT INTO public.app_settings (key, value)
VALUES ('review_request_config', '{"delay_days": 3, "template": null, "google_review_url": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;
