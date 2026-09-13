import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-role";

// The training portal (Akademin, ../utbildning) and this app share one Supabase
// project, so this reads training_user_level_progress directly — no API call to the
// other app needed. See memory project-roslagstak-utbildningsportal-plan for the full
// design: a saljare must pass level 14 (all voice-AI roleplay tests) before getting
// CRM access at all. Existing staff were grandfathered via a one-time data migration
// in the utbildning repo (20260913170000_grandfather_existing_saljare.sql) — this
// hook doesn't special-case that, it just checks the same completed-level-14 row.
export function useTrainingGate() {
  const { user } = useAuth();
  const { isAdmin, roles, loading: rolesLoading } = useUserRoles();
  const [passed, setPassed] = useState<boolean | null>(null);

  // Only a plain saljare (not admin — admins bypass every role gate in this app, same
  // as elsewhere) is subject to this at all. Anyone without the saljare role (e.g. a
  // hantverkare-only account) is never gated, regardless of which route they're on.
  const needsGate = !isAdmin && roles.includes("saljare");

  useEffect(() => {
    let cancelled = false;
    if (!user || !needsGate) {
      setPassed(null);
      return;
    }
    setPassed(null);
    (async () => {
      // Fail OPEN on any error here (log it, don't block) — a transient query failure
      // shouldn't lock a real salesperson out of their job. The gate only actively
      // blocks on a confirmed "not completed" result.
      try {
        const { data: level, error: levelError } = await supabase
          .from("training_levels")
          .select("id")
          .eq("level_number", 14)
          .single();
        if (levelError || !level) {
          console.error("useTrainingGate: could not look up level 14", levelError);
          if (!cancelled) setPassed(true);
          return;
        }
        const { data: progress, error: progressError } = await supabase
          .from("training_user_level_progress")
          .select("status")
          .eq("user_id", user.id)
          .eq("level_id", level.id)
          .maybeSingle();
        if (progressError) {
          console.error("useTrainingGate: could not read progress", progressError);
          if (!cancelled) setPassed(true);
          return;
        }
        if (!cancelled) setPassed(progress?.status === "completed");
      } catch (err) {
        console.error("useTrainingGate: unexpected error", err);
        if (!cancelled) setPassed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, needsGate]);

  return {
    needsGate,
    loading: rolesLoading || (needsGate && passed === null),
    blocked: needsGate && passed === false,
  };
}

export const TRAINING_PORTAL_URL = import.meta.env.VITE_UTBILDNING_URL || "http://localhost:8081";
