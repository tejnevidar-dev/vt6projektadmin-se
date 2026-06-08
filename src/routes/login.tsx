import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { rolesAllowSide, type AppRole, type Side } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, HardHat } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [side, setSide] = useState<Side>("extern");
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
          // Auto-välj sida baserat på inbjudningens roll
          if (rolesAllowSide([(data as any).role as AppRole], "intern")) {
            setSide("intern");
          } else {
            setSide("extern");
          }
        } else {
          setError("Inbjudan är ogiltig eller har gått ut.");
        }
      });
  }, [invite]);

  if (isAuthenticated) {
    navigate({ to: "/" });
    return null;
  }

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
          navigate({ to: "/" });
        }
        return;
      }

      await signIn(email, password);

      // Verifiera att kontot får logga in på vald sida
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Kunde inte verifiera kontot.");
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      const userRoles = (roleRows ?? []).map((r: any) => r.role as AppRole);

      if (!rolesAllowSide(userRoles, side)) {
        await signOut();
        setError(
          side === "intern"
            ? "Detta konto har inte tillgång till intern-sidan. Logga in som extern istället."
            : "Detta konto har inte tillgång till extern-sidan. Logga in som intern istället."
        );
        return;
      }

      navigate({ to: "/" });
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
          {/* Side selector */}
          {!isSignUp && (
            <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => { setSide("extern"); setError(""); }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  side === "extern"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Briefcase className="h-4 w-4" />
                Extern
              </button>
              <button
                type="button"
                onClick={() => { setSide("intern"); setError(""); }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  side === "intern"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <HardHat className="h-4 w-4" />
                Intern
              </button>
            </div>
          )}

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
              {loading ? "Vänta..." : isSignUp ? "Skapa konto" : `Logga in som ${side}`}
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
