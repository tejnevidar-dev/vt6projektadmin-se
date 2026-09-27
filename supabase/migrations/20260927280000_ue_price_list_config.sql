-- UE-prislista (Bilaga 1) som FÖRSLAG i konfiguration – ändrar inget beteende. Används bara av
-- en ny admin-only förslagsfunktion på /arbetsorder ("Förslag ur prislistan, ej bindande"),
-- aldrig av dispatch/PDF/UE-vyn. Källa: ledning/ue/avtal/03-bilaga-1-prislista-arbete.md
-- (Bilaga 1-förslag 2026-09-27, väntar på Vidars beslut B2/B4). Nycklar matchar
-- price_list/calculations (material_key, plat_items), inte snabbkalkylens egna nycklar –
-- se Agent – UE:s granskning 2026-09-27. Ändra värdena här utan ny migration när Bilaga 1
-- är beslutad. Kräver ingen tidigare CRM-migration.
INSERT INTO public.app_settings (key, value)
VALUES ('ue_price_list_config', '{
  "taklaggare": {
    "per_material_kvm": {"betongpannor": 450, "tegelpannor": 500, "papptak": 300},
    "complex_kvm": 600,
    "surcharge_pct": {"two_storeys": 10, "three_plus_storeys": 20, "steep_pitch": 10}
  },
  "platslagare": {
    "per_kvm": {"platt_bandtackning": 750, "platprofil": 280},
    "per_st": {"skorstensinkladnad": 3500},
    "per_lpm": {"fotplat_meter": 70, "vindskiveplat_meter": 70, "snorasskydd_meter": 100}
  },
  "addons": {"ranndal": 1500, "raspont_kvm": 150, "takfonster": 3000}
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
