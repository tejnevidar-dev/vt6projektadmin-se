import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const Route = createFileRoute("/accept-invite")({
  component: AcceptInvitePage,
  validateSearch: (search: Record<string, unknown>): { invite?: string } =>
    typeof search.invite === "string" ? { invite: search.invite } : {},
  head: () => ({
    meta: [
      { title: "Skapa konto – admin.vt6" },
      { name: "description", content: "Slutför din inbjudan till admin.vt6." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

const roleLabel = (r: string) =>
  ({
    admin: "Administratör",
    saljare: "Säljare",
    viewer: "Viewer",
    arbetsledare: "Arbetsledare",
    hantverkare: "Hantverkare",
    underentreprenor: "Underentreprenör",
  } as Record<string, string>)[r] ?? r;

function AcceptInvitePage() {
  const navigate = useNavigate();
  const { invite } = Route.useSearch();
  const { user, signUp, loading: authLoading } = useAuth();

  // "session" = kom via mailets magic-link (auth.users redan skapad, sätt bara lösenord).
  // "token"   = kom via kopierad länk (?invite=TOKEN) → vanlig signup.
  const [mode, setMode] = useState<"loading" | "session" | "token" | "invalid">(
    "loading"
  );
  const [info, setInfo] = useState<{ email: string; role: string } | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    (async () => {
      // Fall A: kom via mailets magic-link → vi har redan en session
      if (user) {
        if (cancelled) return;
        setInfo({ email: user.email ?? "", role: "" });
        setDisplayName(
          (user.user_metadata?.display_name as string) ??
            user.email?.split("@")[0] ??
            ""
        );
        setMode("session");
        return;
      }

      // Fall B: ?invite=TOKEN → slå upp inbjudan
      if (invite) {
        let row: { email: string; role: string } | null = null;
        try {
          const resp = await fetch("/api/public/lookup-invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: invite }),
          });
          if (resp.ok) {
            const json = await resp.json();
            row = json?.invitation ?? null;
          }
        } catch {
          row = null;
        }
        if (cancelled) return;
        if (row) {
          setInfo(row as any);
          setDisplayName((row.email as string).split("@")[0]);
          setMode("token");
        } else {
          setMode("invalid");
        }
        return;
      }

      setMode("invalid");
    })();

    return () => {
      cancelled = true;
    };
  }, [user, invite, authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Lösenordet måste vara minst 8 tecken.");
      return;
    }
    if (password !== password2) {
      setError("Lösenorden matchar inte.");
      return;
    }
    if (!displayName.trim()) {
      setError("Ange ett namn.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "session") {
        const { error: upErr } = await supabase.auth.updateUser({
          password,
          data: { display_name: displayName.trim() },
        });
        if (upErr) throw upErr;
        // Spegla namnet i profiles om det finns
        if (user) {
          await supabase
            .from("profiles")
            .update({ display_name: displayName.trim() })
            .eq("id", user.id);
        }
      } else if (mode === "token" && info && invite) {
        const { needsConfirmation } = await signUp(info.email, password, invite);
        if (needsConfirmation) {
          setError(
            "Konto skapat – kolla din e-post för att bekräfta innan du kan logga in."
          );
          setSubmitting(false);
          return;
        }
        if (user) {
          await supabase
            .from("profiles")
            .update({ display_name: displayName.trim() })
            .eq("id", user.id);
        }
      }
      navigate({ to: "/" });
    } catch (err: any) {
      setError(err.message ?? "Något gick fel");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Slutför din inbjudan</CardTitle>
          <CardDescription>
            {mode === "loading" && "Laddar..."}
            {mode === "invalid" &&
              "Den här länken är ogiltig eller har gått ut. Be administratören om en ny inbjudan."}
            {(mode === "session" || mode === "token") && info && (
              <>
                Välkommen{info.email ? ` ${info.email}` : ""}
                {info.role ? ` – du har bjudits in som ${roleLabel(info.role)}` : ""}.
                Sätt ditt namn och lösenord nedan.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(mode === "session" || mode === "token") && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {info?.email && (
                <div className="space-y-2">
                  <Label htmlFor="email">E-post</Label>
                  <Input id="email" value={info.email} disabled />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="displayName">Namn</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Förnamn Efternamn"
                  required
                  maxLength={80}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Lösenord</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minst 8 tecken"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password2">Bekräfta lösenord</Label>
                <Input
                  id="password2"
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Sparar..." : "Skapa konto"}
              </Button>
            </form>
          )}

          {mode === "invalid" && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate({ to: "/login" })}
            >
              Till inloggning
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
