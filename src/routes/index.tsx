import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles } from "@/hooks/use-role";
import { useWorkspace } from "@/hooks/use-workspace";

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
  const { isAdmin, isEkonomi, isEkonomiOnly, isInternal, isExternal, loading } = useUserRoles();
  const { side } = useWorkspace();

  useEffect(() => {
    if (authLoading || loading) return;
    if (!isAuthenticated) {
      navigate({ to: "/login", search: {} });
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
    navigate({ to: "/dashboard" });
  }, [authLoading, loading, isAuthenticated, isAdmin, isEkonomi, isInternal, isExternal, side, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Laddar…</p>
    </div>
  );
}
