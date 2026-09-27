-- Kopplar en UE-faktura till arbetsordern (via jobbet), så att arbetsordernumret (AO-ÅÅÅÅ-NNNN)
-- kan visas i fakturaformuläret och fakturalistan. Additiv, ändrar inget befintligt beteende.
-- Kräver 20260927120000_work_order_terms.sql (work_orders.order_number/job_id) och att
-- subcontractor_invoices redan finns (20260904192304).
ALTER TABLE public.subcontractor_invoices
  ADD COLUMN IF NOT EXISTS work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_subcontractor_invoices_work_order ON public.subcontractor_invoices(work_order_id);
