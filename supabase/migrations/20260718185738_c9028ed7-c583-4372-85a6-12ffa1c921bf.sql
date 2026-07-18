
CREATE TABLE public.offer_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'combined',
  label text NOT NULL DEFAULT 'Utkast',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_drafts TO authenticated;
GRANT ALL ON public.offer_drafts TO service_role;

ALTER TABLE public.offer_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can select own drafts" ON public.offer_drafts
  FOR SELECT TO authenticated
  USING (auth.uid() = created_by OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "owner can insert own drafts" ON public.offer_drafts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "owner can update own drafts" ON public.offer_drafts
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "owner can delete own drafts" ON public.offer_drafts
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_offer_drafts_updated_at
  BEFORE UPDATE ON public.offer_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX offer_drafts_created_by_idx ON public.offer_drafts(created_by, updated_at DESC);
