-- Vidars beslut (A4, via Agent - UE): VT6 Invest AB:s org.nr i arbetsorderns sidfot/ramavtalsrad.
-- Övriga fält i ue_work_order_defaults (vite, betalning, BAS) väntar fortfarande på beslut och rörs inte.
UPDATE public.app_settings
SET value = value || jsonb_build_object('client_org_number', '559539-3595')
WHERE key = 'ue_work_order_defaults';
