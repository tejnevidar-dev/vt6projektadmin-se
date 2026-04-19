ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS roof_wash_score integer,
  ADD COLUMN IF NOT EXISTS roof_wash_reason text;

CREATE INDEX IF NOT EXISTS idx_properties_roof_wash_score
  ON public.properties (roof_wash_score DESC NULLS LAST);