-- Marginalkonfiguration som visas för admin i kalkylen (Snabbpris). Värden enligt Vidar via Strategi:
-- container 7 000 kr, ställning 0 kr (4 000 kr som känslighet), provision 3 % på kundpris exkl. moms,
-- UE-arbete 450 kr/m2, materialinköp = 100 % av materialets kundpris (försiktigast tills inköpspriser finns).
-- Koden har samma standardvärden, så kalkylen fungerar även utan raden. Ändra värden här utan ny migration.
INSERT INTO public.app_settings (key, value)
VALUES ('margin_config', '{"ue_price_per_kvm": 450, "container_cost": 7000, "scaffold_cost": 0, "provision_pct": 3, "material_cost_pct": 100}'::jsonb)
ON CONFLICT (key) DO NOTHING;
