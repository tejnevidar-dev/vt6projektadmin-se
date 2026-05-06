import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles, type AppRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Copy, Trash2, UserPlus, Shield } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: () => (
    <RequireAuth>
      <AdminPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Medlemmar – Säljpanel" }] }),
});

interface Member {
  id: string;
  email: string;
  display_name: string | null;
  roles: AppRole[];
}
interface Invitation {
  id: string;
  email: string;
  role: AppRole;
  token: string;
  used_at: string | null;
  expires_at: string;
  created_at: string;
}

const roleLabel = (r: AppRole) =>
  r === "admin" ? "Administratör" : r === "saljare" ? "Säljare" : "Viewer";

function AdminPage() {
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("saljare");
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const queries: Promise<any>[] = [
      supabase.from("profiles").select("id, email, display_name").order("created_at"),
      supabase.from("user_roles").select("user_id, role"),
    ];
    if (isAdmin) {
      queries.push(supabase.from("invitations").select("*").order("created_at", { ascending: false }));
    }
    const [profilesRes, rolesRes, invitesRes] = await Promise.all(queries);
    const rolesByUser = new Map<string, AppRole[]>();
    (rolesRes.data ?? []).forEach((r: any) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });
    setMembers(
      (profilesRes.data ?? []).map((p: any) => ({
        ...p,
        roles: rolesByUser.get(p.id) ?? [],
      }))
    );
    if (invitesRes) setInvitations((invitesRes.data ?? []) as Invitation[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!rolesLoading) loadData();
  }, [rolesLoading, isAdmin]);

  const setMemberRole = async (userId: string, newRole: AppRole) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (error) toast.error("Kunde inte uppdatera roll: " + error.message);
    else toast.success("Roll uppdaterad");
    loadData();
  };

  const removeMember = async (userId: string) => {
    if (!confirm("Ta bort all åtkomst för denna användare?")) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (error) toast.error(error.message);
    else toast.success("Åtkomst borttagen");
    loadData();
  };

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setCreating(true);
    const { error } = await supabase
      .from("invitations")
      .insert({ email: inviteEmail.trim().toLowerCase(), role: inviteRole });
    if (error) toast.error(error.message);
    else {
      toast.success("Inbjudan skapad");
      setInviteEmail("");
    }
    setCreating(false);
    loadData();
  };

  const revokeInvite = async (id: string) => {
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Inbjudan borttagen");
    loadData();
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/login?invite=${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Inbjudningslänk kopierad");
  };

  if (rolesLoading || !isAdmin) {
    return (
      <AppShell title="Medlemmar">
        <p className="text-muted-foreground">Laddar...</p>
      </AppShell>
    );
  }

  const pendingInvites = invitations.filter((i) => !i.used_at && new Date(i.expires_at) > new Date());

  return (
    <AppShell
      title="Medlemmar"
      description="Hantera vem som har åtkomst till Säljpanel och vilka rättigheter de har."
    >
      <div className="space-y-8">
        {/* Invite form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4" /> Bjud in ny medlem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createInvite} className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[240px] space-y-1.5">
                <Label htmlFor="invite-email">E-post</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="namn@företag.se"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Roll</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administratör</SelectItem>
                    <SelectItem value="saljare">Säljare</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={creating}>
                {creating ? "Skapar..." : "Skapa inbjudan"}
              </Button>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">
              Kopiera inbjudningslänken nedan och skicka till mottagaren. Länken är giltig i 14 dagar.
            </p>
          </CardContent>
        </Card>

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Väntande inbjudningar ({pendingInvites.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-post</TableHead>
                    <TableHead>Roll</TableHead>
                    <TableHead>Går ut</TableHead>
                    <TableHead className="text-right">Åtgärd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvites.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.email}</TableCell>
                      <TableCell><Badge variant="secondary">{roleLabel(inv.role)}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(inv.expires_at).toLocaleDateString("sv-SE")}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" onClick={() => copyInviteLink(inv.token)}>
                          <Copy className="h-3.5 w-3.5 mr-1.5" /> Kopiera länk
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => revokeInvite(inv.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" /> Medlemmar ({members.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-6 text-muted-foreground">Laddar...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Namn</TableHead>
                    <TableHead>E-post</TableHead>
                    <TableHead>Roll</TableHead>
                    <TableHead className="text-right">Åtgärd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => {
                    const currentRole: AppRole = m.roles.includes("admin")
                      ? "admin"
                      : m.roles.includes("saljare")
                      ? "saljare"
                      : "viewer";
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.display_name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{m.email}</TableCell>
                        <TableCell>
                          <Select
                            value={m.roles.length ? currentRole : "none"}
                            onValueChange={(v) => v !== "none" && setMemberRole(m.id, v as AppRole)}
                          >
                            <SelectTrigger className="w-40 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Administratör</SelectItem>
                              <SelectItem value="saljare">Säljare</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                              {!m.roles.length && <SelectItem value="none" disabled>Ingen åtkomst</SelectItem>}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => removeMember(m.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
