-- Digital signering av UE-ramavtalet (document_type = 'avtal', redan tillåtet sedan
-- 20260905130000). Kopplar en signature_requests-rad till en UE i stället för ett lead.
-- lead_id förblir NULL för dessa rader. Additiv, ändrar inget befintligt beteende.
-- OBS: ledning/ue/avtal/01-ramavtal-ue-sv.md är fortfarande "INTE klart att signera"
-- (Vidars [BESLUT] saknas) - appkoden (ue-agreement-text.ts) vägrar skapa en signerings-
-- begäran så länge det är sant, oavsett denna migration.
ALTER TABLE public.signature_requests
  ADD COLUMN IF NOT EXISTS subcontractor_id uuid REFERENCES public.subcontractors(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_signature_requests_subcontractor ON public.signature_requests(subcontractor_id);
