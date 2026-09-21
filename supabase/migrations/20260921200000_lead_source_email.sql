-- Ny lead-källa för mail som kommer in via info@roslagstak.se (se routes/api/hooks/inbound-email.ts).
ALTER TYPE public.lead_source ADD VALUE IF NOT EXISTS 'email';
