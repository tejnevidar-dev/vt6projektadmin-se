ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commission_rate numeric;

UPDATE public.leads l SET seller_id = l.created_by
 WHERE l.seller_id IS NULL
   AND l.created_by IS NOT NULL
   AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = l.created_by);

CREATE INDEX IF NOT EXISTS idx_leads_seller_id ON public.leads (seller_id);