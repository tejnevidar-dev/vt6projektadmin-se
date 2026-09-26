import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-role";
import { useWorkspace } from "@/hooks/use-workspace";
import { useTrainingGate, TRAINING_PORTAL_URL } from "@/hooks/use-training-gate";

export const Route = createFileRoute("/")({
  component: HomeRedirect,
  head: () => ({
    meta: [
      { title: "admin.vt6 – Startsida" },
      { name: "description", content: "Din startsida i admin.vt6." },
    ],
  }),
});

/** Skickar användaren till rätt startsida beroende på roll och arbetsyta. */
function HomeRedirect() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isAdmin, isEkonomi, isEkonomiOnly, isInternal, isExternal, roles, loading } = useUserRoles();
  const { side } = useWorkspace();
  // UX shortcut only, same as valj-panel.tsx — RequireAuth on the actual destination
  // route is what enforces this. See src/hooks/use-training-gate.ts.
  const gate = useTrainingGate();

  useEffect(() => {
    if (authLoading || loading || gate.loading) return;
    if (!isAuthenticated) {
      navigate({ to: "/login", search: {} });
      return;
    }
    if (!isAdmin && roles.includes("underentreprenor")) {
      navigate({ to: "/ue" });
      return;
    }
    if (isEkonomiOnly) {
      navigate({ to: "/ekonomi" });
      return;
    }
    if (side === "intern") {
      navigate({ to: isAdmin ? "/jobb" : "/egenkontroller" });
      return;
    }
    if (isEkonomi && !isAdmin) {
      navigate({ to: "/ekonomi/rot" });
      return;
    }

    if (!isExternal && isInternal) {
      navigate({ to: "/jobb" });
      return;
    }
    if (gate.blocked) {
      window.location.href = TRAINING_PORTAL_URL;
      return;
    }
    navigate({ to: "/dashboard" });
  }, [authLoading, loading, isAuthenticated, isAdmin, isEkonomi, isEkonomiOnly, isInternal, isExternal, roles, side, navigate, gate.loading, gate.blocked]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Laddar…</p>
    </div>
  );
}
