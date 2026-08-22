ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_action_note text;
CREATE INDEX IF NOT EXISTS leads_next_action_at_idx ON public.leads (next_action_at);