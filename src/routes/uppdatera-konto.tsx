import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { applyAccountRefresh } from "@/lib/account-refresh.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/uppdatera-konto")({
  component: RefreshAccountPage,
  head: () => ({
    meta: [
      { title: "Förnya ditt konto – admin.vt6" },
      {
        name: "description",
        content:
          "Uppdatera dina uppgifter och sätt ett nytt lösenord för att förnya ditt admin.vt6-konto.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function RefreshAccountPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setReady(true);
        setEmail(data.session.user.email ?? "");
        setDisplayName(
          (data.session.user.user_metadata as any)?.display_name ??
            data.session.user.email?.split("@")[0] ??
            ""
        );
      }
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
        if (session) {
          setEmail(session.user.email ?? "");
          setDisplayName((prev) =>
            prev ||
            ((session.user.user_metadata as any)?.display_name ??
              session.user.email?.split("@")[0] ??
              "")
          );
        }
      }
    });
    void bootstrap();
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!displayName.trim()) {
      setError("Ange ditt namn.");
      return;
    }
    if (password.length < 8) {
      setError("Lösenordet måste vara minst 8 tecken.");
      return;
    }
    if (password !== confirm) {
      setError("Lösenorden matchar inte.");
      return;
    }
    setSaving(true);
    try {
      await applyAccountRefresh({
        data: {
          displayName: displayName.trim(),
          phone: phone.trim(),
          password,
        },
      });
      toast.success("Kontot är uppdaterat");
      // Logga ut och tillbaka till inloggning så nästa session är helt ren
      await supabase.auth.signOut();
      navigate({ to: "/login" });
    } catch (err: any) {
      setError(err.message ?? "Kunde inte uppdatera kontot");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Förnya ditt konto</CardTitle>
          <CardDescription>
            {ready
              ? "Bekräfta dina uppgifter och välj ett nytt lösenord. Dina gamla inloggningar loggas ut."
              : "Verifierar länken…"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-post</Label>
              <Input id="email" type="email" value={email} disabled readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Fullständigt namn</Label>
              <Input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                disabled={!ready}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon (valfritt)</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={!ready}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Nytt lösenord</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={!ready}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Bekräfta lösenord</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                disabled={!ready}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={!ready || saving}>
              {saving ? "Uppdaterar…" : "Uppdatera konto"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
