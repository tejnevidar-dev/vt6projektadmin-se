CREATE TABLE public.quick_price_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service text NOT NULL CHECK (service IN ('takbyte','taktvatt')),
  kind text NOT NULL CHECK (kind IN ('material','arbete','tillval','svarighet')),
  key text NOT NULL,
  label text NOT NULL,
  unit text NOT NULL CHECK (unit IN ('kvm','st','procent','fast')),
  unit_price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service, kind, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_price_items TO authenticated;
GRANT ALL ON public.quick_price_items TO service_role;
ALTER TABLE public.quick_price_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quick_price_items_select" ON public.quick_price_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "quick_price_items_admin_write" ON public.quick_price_items FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role));

CREATE TRIGGER update_quick_price_items_updated_at BEFORE UPDATE ON public.quick_price_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.quick_price_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  moms_procent numeric NOT NULL DEFAULT 25,
  rot_procent numeric NOT NULL DEFAULT 30,
  rot_tak_per_agare numeric NOT NULL DEFAULT 50000,
  taktvatt_min_pris numeric NOT NULL DEFAULT 12000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.quick_price_settings TO authenticated;
GRANT ALL ON public.quick_price_settings TO service_role;
ALTER TABLE public.quick_price_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quick_price_settings_select" ON public.quick_price_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "quick_price_settings_admin_write" ON public.quick_price_settings FOR ALL TO authenticated USING (private.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role));

CREATE TRIGGER update_quick_price_settings_updated_at BEFORE UPDATE ON public.quick_price_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.quick_price_settings (id) VALUES (1);

INSERT INTO public.quick_price_items (service, kind, key, label, unit, unit_price, sort_order) VALUES
('takbyte','material','betongpannor','Betongpannor',        'kvm', 480, 10),
('takbyte','material','tegelpannor','Tegelpannor',          'kvm', 620, 20),
('takbyte','material','plat_bandtackning','Plåt – bandtäckning','kvm', 850, 30),
('takbyte','material','platprofil','Plåtprofil (trapets)',  'kvm', 420, 40),
('takbyte','material','papp','Takpapp (låglutande)',        'kvm', 390, 50),
('takbyte','arbete','arbete_standard','Arbete – standardtak','kvm', 900, 10),
('takbyte','arbete','arbete_komplext','Arbete – komplext tak','kvm', 1150, 20),
('takbyte','svarighet','en_vaning','1 våning',              'procent', 0, 10),
('takbyte','svarighet','tva_vaningar','2 våningar',         'procent', 12, 20),
('takbyte','svarighet','tre_vaningar','3+ våningar / svår åtkomst','procent', 25, 30),
('takbyte','tillval','ranndalar','Ränndalar',               'st', 3500, 10),
('takbyte','tillval','skorsten','Skorstensinklädnad',       'st', 8500, 20),
('takbyte','tillval','takfonster','Takfönster (byte)',      'st', 9500, 30),
('takbyte','tillval','hangrannor','Hängrännor & stuprör',   'kvm', 180, 40),
('takbyte','tillval','undertak','Byte av undertak/råspont', 'kvm', 350, 50),
('takbyte','tillval','stallning','Ställning',               'kvm', 120, 60),
('takbyte','tillval','snoskydd','Snörasskydd',              'st', 1200, 70),
('taktvatt','material','tvatt_bas','Taktvätt – grundpris',  'kvm', 95, 10),
('taktvatt','svarighet','tv_en_vaning','1 våning',          'procent', 0, 10),
('taktvatt','svarighet','tv_tva_vaningar','2 våningar',     'procent', 15, 20),
('taktvatt','svarighet','tv_tre_vaningar','3+ våningar / svår åtkomst','procent', 30, 30),
('taktvatt','tillval','algbehandling','Algbehandling',      'kvm', 35, 10),
('taktvatt','tillval','impregnering','Impregnering',        'kvm', 55, 20),
('taktvatt','tillval','rensning_rannor','Rensning hängrännor','kvm', 25, 30),
('taktvatt','tillval','malning','Målning av tak',           'kvm', 220, 40),
('taktvatt','tillval','mossrensning','Mossrensning (manuell)','kvm', 45, 50);