-- Replace the permissive "all authenticated can read" policy with a scoped one
DROP POLICY IF EXISTS "Authenticated users can select leads" ON public.leads;

CREATE POLICY "Leads visibility scoped by role"
ON public.leads
FOR SELECT
TO authenticated
USING (
  -- Admin and sales see everything
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'saljare'::app_role)
  -- Internal staff only see leads assigned to them
  OR (
    (
      private.has_role(auth.uid(), 'arbetsledare'::app_role)
      OR private.has_role(auth.uid(), 'hantverkare'::app_role)
      OR private.has_role(auth.uid(), 'underentreprenor'::app_role)
    )
    AND assigned_to = auth.uid()
  )
);
