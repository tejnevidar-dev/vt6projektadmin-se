-- Ramverk för kundvillkor (ångerrätt, byggherreansvar, garanti) i offert-/signeringsflödet.
-- Driftchefens uppdrag 2026-09-27: bygg ramverket UTAN juridisk text - Agent - Jurist äger
-- texterna och levererar dem separat till Agent - CRM. Scaffolden är INAKTIV (active: false,
-- alla texter null), så BEFINTLIGA offerter och signeringar (inklusive de 12 utestående
-- v40-v42) påverkas inte alls förrän Vidar uttryckligen sätter active: true efter att texterna
-- finns och är godkända. "Inget går till riktiga kunder förrän Vidar har gett OK."
--
-- Fyll i texterna med en enkel UPDATE när de finns, ingen ny migration behövs:
--   UPDATE public.app_settings SET value = value || jsonb_build_object(
--     'active', true, 'version', '2026-xx-v1',
--     'angerratt_text', '...', 'byggherreansvar_text', '...',
--     'garanti_text', '...', 'angerblankett_text', '...',
--     'ack_labels', jsonb_build_object('angerratt', '...', 'byggherreansvar', '...', 'garanti', '...')
--   ) WHERE key = 'customer_terms';
INSERT INTO public.app_settings (key, value)
VALUES ('customer_terms', '{
  "active": false,
  "version": null,
  "angerratt_text": null,
  "byggherreansvar_text": null,
  "garanti_text": null,
  "angerblankett_text": null,
  "ack_labels": {}
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- NULL = befintligt beteende (dagens offerter: ingen villkorsblock i PDF:en, ingen spärr vid
-- signering). Sätts bara av createSigningRequest när customer_terms.active är sant vid den
-- tidpunkt offerten skapas - äldre/redan skapade rader förblir NULL för alltid.
ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS customer_terms_version text,
  ADD COLUMN IF NOT EXISTS customer_terms_ack jsonb NOT NULL DEFAULT '{}'::jsonb;
