
-- Drop old permissive policies
DROP POLICY IF EXISTS "Allow all access to leads" ON public.leads;
DROP POLICY IF EXISTS "Allow all access to properties" ON public.properties;

-- Leads: authenticated users only
CREATE POLICY "Authenticated users can select leads"
  ON public.leads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert leads"
  ON public.leads FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update leads"
  ON public.leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete leads"
  ON public.leads FOR DELETE TO authenticated USING (true);

-- Properties: authenticated users only
CREATE POLICY "Authenticated users can select properties"
  ON public.properties FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert properties"
  ON public.properties FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update properties"
  ON public.properties FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete properties"
  ON public.properties FOR DELETE TO authenticated USING (true);
