-- Calendar events with per-side (intern/extern) separation and per-user/per-role sharing
CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  side text NOT NULL CHECK (side IN ('intern','extern')),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  location text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.calendar_event_shares_users (
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE public.calendar_event_shares_roles (
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_event_shares_users TO authenticated;
GRANT ALL ON public.calendar_event_shares_users TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_event_shares_roles TO authenticated;
GRANT ALL ON public.calendar_event_shares_roles TO service_role;

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_event_shares_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_event_shares_roles ENABLE ROW LEVEL SECURITY;

-- Helper: does the current user have any role shared on the event?
CREATE OR REPLACE FUNCTION public.can_view_calendar_event(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.calendar_events e WHERE e.id = _event_id AND e.owner_id = auth.uid()
  )
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.calendar_event_shares_users s
    WHERE s.event_id = _event_id AND s.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.calendar_event_shares_roles sr
    JOIN public.user_roles ur ON ur.role = sr.role
    WHERE sr.event_id = _event_id AND ur.user_id = auth.uid()
  );
$$;

-- calendar_events policies
CREATE POLICY "view own or shared or admin"
ON public.calendar_events FOR SELECT TO authenticated
USING (public.can_view_calendar_event(id));

CREATE POLICY "insert own"
ON public.calendar_events FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner or admin update"
ON public.calendar_events FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (owner_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "owner or admin delete"
ON public.calendar_events FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role));

-- shares_users policies
CREATE POLICY "view shares if can view event"
ON public.calendar_event_shares_users FOR SELECT TO authenticated
USING (public.can_view_calendar_event(event_id));

CREATE POLICY "owner or admin manages user-shares insert"
ON public.calendar_event_shares_users FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.calendar_events e WHERE e.id = event_id AND e.owner_id = auth.uid())
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "owner or admin manages user-shares delete"
ON public.calendar_event_shares_users FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.calendar_events e WHERE e.id = event_id AND e.owner_id = auth.uid())
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
);

-- shares_roles policies
CREATE POLICY "view role-shares if can view event"
ON public.calendar_event_shares_roles FOR SELECT TO authenticated
USING (public.can_view_calendar_event(event_id));

CREATE POLICY "owner or admin manages role-shares insert"
ON public.calendar_event_shares_roles FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.calendar_events e WHERE e.id = event_id AND e.owner_id = auth.uid())
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "owner or admin manages role-shares delete"
ON public.calendar_event_shares_roles FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.calendar_events e WHERE e.id = event_id AND e.owner_id = auth.uid())
  OR private.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_calendar_events_side_start ON public.calendar_events(side, start_at);
CREATE INDEX idx_calendar_events_owner ON public.calendar_events(owner_id);
CREATE INDEX idx_calendar_event_shares_users_user ON public.calendar_event_shares_users(user_id);
CREATE INDEX idx_calendar_event_shares_roles_role ON public.calendar_event_shares_roles(role);