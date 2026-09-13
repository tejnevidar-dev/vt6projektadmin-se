import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles, type Side } from "@/hooks/use-role";
import { useWorkspace } from "@/hooks/use-workspace";
import { useTrainingGate, TRAINING_PORTAL_URL } from "@/hooks/use-training-gate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, HardHat } from "lucide-react";

export const Route = createFileRoute("/valj-panel")({
  component: ChooseWorkspacePage,
  head: () => ({
    meta: [
      { title: "Välj panel – admin.vt6" },
      { name: "description", content: "Välj vilken arbetsyta du vill arbeta i." },
    ],
  }),
});

function ChooseWorkspacePage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, signOut } = useAuth();
  const { isInternal, isExternal, loading } = useUserRoles();
  const { setSide } = useWorkspace();
  // A saljare who hasn't passed level 14 in Akademin gets sent to the training portal
  // instead of the CRM panel — see src/hooks/use-training-gate.ts. This is a UX
  // shortcut (skip the flash of navigating in before RequireAuth would bounce them
  // right back out); RequireAuth is what actually enforces this, not this check.
  const gate = useTrainingGate();

  const choose = (s: Side) => {
    if (s === "extern" && gate.blocked) {
      window.location.href = TRAINING_PORTAL_URL;
      return;
    }
    setSide(s);
    navigate({ to: "/" });
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: "/login", search: {} });
      return;
    }
    if (loading || gate.loading) return;
    // Endast en panel tilldelad → gå direkt in i den.
    if (isInternal && !isExternal) choose("intern");
    else if (isExternal && !isInternal) choose("extern");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, loading, isInternal, isExternal, gate.loading, gate.blocked]);

  if (authLoading || loading || gate.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Laddar...</p>
      </div>
    );
  }

  if (!isInternal && !isExternal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle className="text-xl">Ingen panel tilldelad</CardTitle>
            <CardDescription>
              Ditt konto saknar roll för både intern panel och CRM. Kontakta en administratör.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => signOut()}>
              Logga ut
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Välj panel</CardTitle>
          <CardDescription>Du har tillgång till båda arbetsytorna</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => choose("extern")}
            className="flex flex-col items-center gap-2 rounded-lg border border-border bg-muted/30 p-6 transition-colors hover:border-primary hover:bg-muted"
          >
            <Briefcase className="h-7 w-7 text-primary" />
            <span className="font-medium">CRM</span>
            <span className="text-xs text-muted-foreground">Sälj, leads och offerter</span>
          </button>
          <button
            type="button"
            onClick={() => choose("intern")}
            className="flex flex-col items-center gap-2 rounded-lg border border-border bg-muted/30 p-6 transition-colors hover:border-primary hover:bg-muted"
          >
            <HardHat className="h-7 w-7 text-primary" />
            <span className="font-medium">Intern</span>
            <span className="text-xs text-muted-foreground">Jobb, tid och egenkontroller</span>
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
