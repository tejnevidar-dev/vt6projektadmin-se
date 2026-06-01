import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Home } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>): { invite?: string } =>
    typeof search.invite === "string" ? { invite: search.invite } : {},
  head: () => ({
    meta: [
      { title: "Logga in – admin.vt6" },
      { name: "description", content: "Logga in på admin.vt6 för att hantera dina leads." },
    ],
  }),
});

function LoginPage() {
  const { signIn, signUp, isAuthenticated } = useAuth();
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
      } else {
        await signIn(email, password);
        navigate({ to: "/" });
      }
    } catch (err: any) {
      setError(err.message || "Något gick fel");
    } finally {
      setLoading(false);
    }
  };

  const roleLabel = (r: string) => r === "admin" ? "Administratör" : r === "saljare" ? "Säljare" : "Viewer";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Home className="h-5 w-5 text-primary-foreground" />
          </div>
          <CardTitle>{isSignUp ? "Skapa konto" : "Logga in"}</CardTitle>
          <CardDescription>
            {inviteInfo
              ? `Du har blivit inbjuden som ${roleLabel(inviteInfo.role)}`
              : isSignUp ? "Registrera ett nytt konto" : "Logga in på admin.vt6"}
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
