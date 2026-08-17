import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { type AppRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>): { invite?: string } =>
    typeof search.invite === "string" ? { invite: search.invite } : {},
  head: () => ({
    meta: [
      { title: "Logga in – admin.vt6" },
      { name: "description", content: "Logga in på admin.vt6." },
    ],
  }),
});

function LoginPage() {
  const { signIn, signUp, signOut, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { invite } = Route.useSearch();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<{ email: string; role: string } | null>(null);

  useEffect(() => {
    if (!invite) return;
    setIsSignUp(true);
    supabase
      .from("invitations")
      .select("email, role")
      .eq("token", invite)
      .is("used_at", null)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setInviteInfo(data as any);
          setEmail((data as any).email);
        } else {
          setError("Inbjudan är ogiltig eller har gått ut.");
        }
      });
  }, [invite]);

  useEffect(() => {
    if (isAuthenticated) navigate({ to: "/valj-panel" });
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) return null;


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (isSignUp) {
        const { needsConfirmation } = await signUp(email, password, invite);
        if (needsConfirmation) {
          setMessage("Kolla din e-post för att bekräfta kontot!");
        } else {
          navigate({ to: "/valj-panel" });
        }
        return;
      }

      await signIn(email, password);

      // Kontrollera att kontot har någon behörighet alls – valet av panel
      // sker sedan på /valj-panel.
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Kunde inte verifiera kontot.");
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      const userRoles = (roleRows ?? []).map((r: any) => r.role as AppRole);

      if (userRoles.length === 0) {
        await signOut();
        setError("Kontot saknar behörighet i systemet. Be en administratör tilldela dig en roll.");
        return;
      }

      navigate({ to: "/valj-panel" });
    } catch (err: any) {
      setError(err.message || "Något gick fel");
    } finally {
      setLoading(false);
    }
  };

  const roleLabel = (r: string) =>
    ({
      admin: "Administratör",
      saljare: "Säljare",
      ekonomi: "Ekonomi",
      viewer: "Viewer",
      arbetsledare: "Arbetsledare",
      hantverkare: "Hantverkare",
      underentreprenor: "Underentreprenör",
    } as Record<string, string>)[r] ?? r;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">admin.vt6</CardTitle>
          <CardDescription>
            {inviteInfo
              ? `Du har blivit inbjuden som ${roleLabel(inviteInfo.role)}`
              : isSignUp
              ? "Skapa nytt konto"
              : "Logga in"}
          </CardDescription>
        </CardHeader>
        <CardContent>


          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-post</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="namn@företag.se"
                required
                disabled={!!inviteInfo}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Lösenord</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {message && <p className="text-sm text-green-600">{message}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Vänta..." : isSignUp ? "Skapa konto" : "Logga in"}
            </Button>
          </form>
          {!invite && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setError(""); setMessage(""); }}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                {isSignUp ? "Har redan ett konto? Logga in" : "Inget konto? Registrera dig"}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
