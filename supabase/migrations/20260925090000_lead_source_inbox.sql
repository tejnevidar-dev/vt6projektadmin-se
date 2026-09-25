-- Ny lead-källa för leads som kommer in via den gemensamma ingången
-- (routes/api/public/lead-inbox.ts). Kanal/kampanj/UTM sparas på leadens första aktivitet.
ALTER TYPE public.lead_source ADD VALUE IF NOT EXISTS 'inbox';
