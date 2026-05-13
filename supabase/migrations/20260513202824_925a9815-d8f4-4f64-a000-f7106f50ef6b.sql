
-- Add assignment and score to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS score integer;

CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_score ON public.leads(score DESC);

-- Activity log
CREATE TYPE public.activity_type AS ENUM (
  'created', 'stage_change', 'status_change', 'assignment',
  'note', 'call', 'pitch_generated', 'updated'
);

CREATE TABLE public.lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id uuid,
  type public.activity_type NOT NULL,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_activities_lead_id ON public.lead_activities(lead_id, created_at DESC);

ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read activities"
  ON public.lead_activities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Saljare and admin can insert activities"
  ON public.lead_activities FOR INSERT
  TO authenticated
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR private.has_role(auth.uid(), 'saljare'::app_role)
  );

CREATE POLICY "Admins can delete activities"
  ON public.lead_activities FOR DELETE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
