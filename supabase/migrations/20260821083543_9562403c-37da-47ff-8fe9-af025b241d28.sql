CREATE TYPE public.lost_reason AS ENUM (
  'for_dyrt',
  'konkurrent',
  'kunden_avvaktar',
  'ingen_finansiering',
  'svarar_inte',
  'projektet_installt',
  'annan_losning',
  'dalig_timing',
  'annat'
);

ALTER TABLE public.leads
  ADD COLUMN lost_reason public.lost_reason,
  ADD COLUMN lost_competitor text,
  ADD COLUMN lost_note text,
  ADD COLUMN lost_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.set_lead_lost_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.pipeline_stage = 'forlorad'::public.pipeline_stage OR NEW.status = 'lost'::public.lead_status)
     AND NEW.lost_at IS NULL THEN
    NEW.lost_at := now();
  END IF;
  IF NEW.pipeline_stage <> 'forlorad'::public.pipeline_stage
     AND NEW.status <> 'lost'::public.lead_status THEN
    NEW.lost_at := NULL;
    NEW.lost_reason := NULL;
    NEW.lost_competitor := NULL;
    NEW.lost_note := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lead_lost_at
BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.set_lead_lost_at();

CREATE TABLE public.sales_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  revenue_goal numeric NOT NULL DEFAULT 0,
  deals_goal integer NOT NULL DEFAULT 0,
  meetings_goal integer NOT NULL DEFAULT 0,
  offers_goal integer NOT NULL DEFAULT 0,
  win_rate_goal numeric NOT NULL DEFAULT 0,
  avg_order_goal numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sales_goals_seller_period_key
  ON public.sales_goals (COALESCE(seller_id, '00000000-0000-0000-0000-000000000000'::uuid), period_month);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_goals TO authenticated;
GRANT ALL ON public.sales_goals TO service_role;

ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sales goals"
  ON public.sales_goals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert sales goals"
  ON public.sales_goals FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update sales goals"
  ON public.sales_goals FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete sales goals"
  ON public.sales_goals FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_sales_goals_updated_at
BEFORE UPDATE ON public.sales_goals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();