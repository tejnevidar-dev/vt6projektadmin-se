import { createFileRoute } from "@tanstack/react-router";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Inställningar – Sälj tak" }] }),
});

function SettingsPage() {
  return (
    <RequireAuth>
      <AppShell title="Inställningar">
        <SettingsContent />
      </AppShell>
    </RequireAuth>
  );
}

function SettingsContent() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Inställningar</h2>
        <p className="text-sm text-muted-foreground">Hantera ditt konto</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="mb-4 text-sm font-semibold">Konto</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">E-post</dt>
            <dd className="font-medium">{user?.email ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Användar-ID</dt>
            <dd className="font-mono text-xs">{user?.id ?? "—"}</dd>
          </div>
        </dl>
        <div className="mt-6 border-t border-border pt-4">
          <Button variant="destructive" onClick={handleSignOut}>Logga ut</Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="mb-2 text-sm font-semibold">Webhook-endpoint</h3>
        <p className="mb-3 text-sm text-muted-foreground">
          Inkommande leads från RoslagsTak.se skickas till denna URL:
        </p>
        <code className="block rounded bg-muted p-3 text-xs">/api/public/roslagstak-webhook</code>
      </div>
    </div>
  );
}
