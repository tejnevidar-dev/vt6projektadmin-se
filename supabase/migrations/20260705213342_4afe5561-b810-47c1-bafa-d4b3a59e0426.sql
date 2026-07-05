
-- Enums
CREATE TYPE public.price_category AS ENUM ('material', 'arbete', 'plat', 'tillagg');
CREATE TYPE public.price_unit AS ENUM ('kvm', 'meter', 'st', 'timme', 'paket');
CREATE TYPE public.offer_status AS ENUM ('draft', 'skickad', 'accepterad', 'avvisad');

-- ============================================================
-- price_list
-- ============================================================
CREATE TABLE public.price_list (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category public.price_category NOT NULL,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  unit public.price_unit NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.price_list TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.price_list TO authenticated;
GRANT ALL ON public.price_list TO service_role;

ALTER TABLE public.price_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alla inloggade kan läsa prislistan"
  ON public.price_list FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Endast admin kan skapa prisrader"
  ON public.price_list FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Endast admin kan uppdatera prisrader"
  ON public.price_list FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Endast admin kan ta bort prisrader"
  ON public.price_list FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_price_list_updated_at
  BEFORE UPDATE ON public.price_list
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed startpriser (placeholder — redigeras i admin)
INSERT INTO public.price_list (category, key, label, unit, unit_price, sort_order) VALUES
  ('material', 'betongpannor',       'Betongpannor',           'kvm',   450, 10),
  ('material', 'tegelpannor',        'Tegelpannor',            'kvm',   550, 20),
  ('material', 'platt_bandtackning', 'Plåt bandtäckning',      'kvm',   750, 30),
  ('material', 'papptak',            'Papptak',                'kvm',   400, 40),
  ('plat',     'ranndalar_meter',    'Ränndalar',              'meter', 350, 10),
  ('plat',     'skorstensinkladnad', 'Skorstensinklädnad',     'st',   8500, 20),
  ('plat',     'fotplat_meter',      'Fotplåt',                'meter', 250, 30),
  ('plat',     'vindskiveplat_meter','Vindskiveplåt',          'meter', 300, 40),
  ('plat',     'takstege_st',        'Takstege',               'st',   3500, 50),
  ('plat',     'snorasskydd_meter',  'Snörasskydd',            'meter', 550, 60),
  ('arbete',   'takarbete_timme',    'Takarbete',              'timme', 650, 10);

-- ============================================================
-- calculations
-- ============================================================
CREATE TABLE public.calculations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  roof_area_kvm NUMERIC(10,2) NOT NULL DEFAULT 0,
  material_key TEXT,
  ranndalar_meter NUMERIC(10,2) NOT NULL DEFAULT 0,
  plat_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  tillagg JSONB NOT NULL DEFAULT '[]'::jsonb,
  arbete_timmar NUMERIC(10,2) NOT NULL DEFAULT 0,
  arbete_timpris NUMERIC(12,2) NOT NULL DEFAULT 650,
  marginal_procent NUMERIC(5,2) NOT NULL DEFAULT 0,
  rot_avdrag BOOLEAN NOT NULL DEFAULT TRUE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  moms NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  rot_belopp NUMERIC(12,2) NOT NULL DEFAULT 0,
  att_betala NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calculations TO authenticated;
GRANT ALL ON public.calculations TO service_role;

ALTER TABLE public.calculations ENABLE ROW LEVEL SECURITY;

-- Säljare ser bara sina egna kalkyler (via leadens skapare); admin ser allt
CREATE POLICY "Läs kalkyler för egna leads eller som admin"
  ON public.calculations FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = calculations.lead_id AND l.created_by = auth.uid())
  );

CREATE POLICY "Skapa kalkyl (admin eller säljare)"
  ON public.calculations FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      private.has_role(auth.uid(), 'admin'::app_role)
      OR private.has_role(auth.uid(), 'saljare'::app_role)
    )
  );

CREATE POLICY "Uppdatera egen kalkyl eller som admin"
  ON public.calculations FOR UPDATE TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
  );

CREATE POLICY "Ta bort som admin"
  ON public.calculations FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_calculations_updated_at
  BEFORE UPDATE ON public.calculations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- offers (historik)
-- ============================================================
CREATE TABLE public.offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  calculation_id UUID REFERENCES public.calculations(id) ON DELETE SET NULL,
  version INTEGER NOT NULL,
  pdf_path TEXT NOT NULL,
  status public.offer_status NOT NULL DEFAULT 'draft',
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lead_id, version)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Läs offerter för egna leads eller som admin"
  ON public.offers FOR SELECT TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = offers.lead_id AND l.created_by = auth.uid())
  );

CREATE POLICY "Skapa offert (admin eller säljare)"
  ON public.offers FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      private.has_role(auth.uid(), 'admin'::app_role)
      OR private.has_role(auth.uid(), 'saljare'::app_role)
    )
  );

CREATE POLICY "Uppdatera offert (egen eller admin)"
  ON public.offers FOR UPDATE TO authenticated
  USING (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
  )
  WITH CHECK (
    private.has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
  );

CREATE POLICY "Ta bort offert som admin"
  ON public.offers FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_offers_updated_at
  BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_offers_lead ON public.offers(lead_id);
CREATE INDEX idx_calculations_lead ON public.calculations(lead_id);
