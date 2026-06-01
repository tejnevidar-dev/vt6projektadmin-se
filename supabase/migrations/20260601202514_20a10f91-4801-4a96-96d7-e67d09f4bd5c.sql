
-- 1. Lägg till nya roller för intern personal
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'arbetsledare';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hantverkare';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'underentreprenor';
