-- Ny roll för externa säljare (t.ex. dörrknackare). Policyerna kommer i nästa migration
-- (ett nytt enum-värde kan inte användas i samma transaktion som det skapas).
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'saljare_extern';
