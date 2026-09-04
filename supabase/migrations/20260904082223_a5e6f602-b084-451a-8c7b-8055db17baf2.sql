ALTER TABLE public.quick_price_items DROP CONSTRAINT IF EXISTS quick_price_items_kind_check;
ALTER TABLE public.quick_price_items ADD CONSTRAINT quick_price_items_kind_check CHECK (kind IN ('material','arbete','tillval','svarighet','lutning'));
ALTER TABLE public.quick_price_items DROP CONSTRAINT IF EXISTS quick_price_items_unit_check;
ALTER TABLE public.quick_price_items ADD CONSTRAINT quick_price_items_unit_check CHECK (unit IN ('kvm','st','procent','fast','lpm'));