-- Lägg till nytt pipeline-stadie för inkommande webbleads
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'inkommande_webb' BEFORE 'saljpanel';

-- Lägg till ny lead source för Roslagstak
ALTER TYPE public.lead_source ADD VALUE IF NOT EXISTS 'roslagstak';

-- Idempotency: undvik dubblettimport av samma quote_request
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS leads_external_id_key ON public.leads(external_id) WHERE external_id IS NOT NULL;

-- Spara epost (finns redan som kolumn) — inget mer behövs där.