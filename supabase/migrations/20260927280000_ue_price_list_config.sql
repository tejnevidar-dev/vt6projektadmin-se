-- UE-prislista (Bilaga 1) som FÖRSLAG i konfiguration – ändrar inget beteende. Används bara av
-- en ny admin-only förslagsfunktion på /arbetsorder ("Förslag ur prislistan, ej bindande"),
-- aldrig av dispatch/PDF/UE-vyn. Källa: ledning/ue/03-prislista-ue-utkast.md, alla värden är
-- Agent – UE:s 🟡-antaganden och INTE beslutade av Vidar. Ändra värdena här utan ny migration
-- när Bilaga 1 är klar. Kräver ingen tidigare CRM-migration.
INSERT INTO public.app_settings (key, value)
VALUES ('ue_price_list_config', '{
  "taklaggare": {
    "per_material_kvm": {"betongpannor": 400, "tegelpannor": 440, "papp": 300},
    "complex_kvm": 520,
    "surcharge_pct": {"two_storeys": 10, "three_plus_storeys": 20, "steep_pitch": 10}
  },
  "platslagare": {
    "per_kvm": {"plat_bandtackning": 650, "platprofil": 280},
    "per_st": {"skorstensinklädnad": 3500},
    "per_lpm": {"hangrannor": 90, "fotplat": 70, "vindskiveplat": 70}
  },
  "addons": {"ranndal": 1500, "raspont_kvm": 150, "takfonster": 3000, "snoskydd": 400}
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
