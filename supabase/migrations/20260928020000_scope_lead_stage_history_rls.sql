-- Driftchefens granskningsuppdrag 2026-09-28: kontrollera om leads/properties fortfarande har
-- de breda "authenticated USING (true)"-policyerna från 20260414210533. SVAR (se passrapport):
-- leads och properties är redan korrekt åtgärdade (20260506112523+121915 för
-- insert/update/delete, 20260601203653 respektive 20260629195042 för select) - inget att göra
-- där. lead_stage_history (20260917090000) missade dock samma uppstädning: dess SELECT-policy
-- är fortfarande "TO authenticated USING (true)", med en kommentar som felaktigt påstår att den
-- "matchar leads' delade pool-modell" - leads SELECT är i själva verket redan scopead
-- (arbetsledare/hantverkare/underentreprenor ser bara assigned_to=egna leads sedan
-- 20260601203653). En UE eller hantverkare kan alltså idag läsa pipeline-stegbyten
-- (from_stage/to_stage/changed_at, kopplat till lead_id) för VILKEN lead som helst, inte bara
-- sina egna. Lägre allvarlighetsgrad än namn/telefon (inga sådana fält i tabellen), men samma
-- princip som Driftchefens fynd i booking_requests.
DROP POLICY IF EXISTS "Authenticated can view lead stage history" ON public.lead_stage_history;

CREATE POLICY "Lead stage history scoped by role"
ON public.lead_stage_history FOR SELECT TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  OR private.has_role(auth.uid(), 'saljare'::app_role)
  OR private.has_role(auth.uid(), 'ekonomi'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = lead_stage_history.lead_id
      AND (
        (
          private.has_role(auth.uid(), 'arbetsledare'::app_role)
          OR private.has_role(auth.uid(), 'hantverkare'::app_role)
          OR private.has_role(auth.uid(), 'underentreprenor'::app_role)
        )
        AND l.assigned_to = auth.uid()
      )
  )
);
