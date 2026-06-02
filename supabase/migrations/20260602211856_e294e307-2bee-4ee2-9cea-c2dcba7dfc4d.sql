
CREATE TABLE public.self_check_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text NOT NULL,
  field_label text,
  instruction text NOT NULL DEFAULT '',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_key, field_label)
);

GRANT SELECT ON public.self_check_instructions TO authenticated;
GRANT ALL ON public.self_check_instructions TO service_role;

ALTER TABLE public.self_check_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read instructions"
ON public.self_check_instructions FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins manage instructions"
ON public.self_check_instructions FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_self_check_instructions_updated
BEFORE UPDATE ON public.self_check_instructions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
