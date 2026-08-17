import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles, type AppRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Copy,
  Trash2,
  UserPlus,
  Shield,
  Users,
  Link2,
  Mail,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  component: () => (
    <RequireAuth>
      <AdminPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Medlemmar – admin.vt6" }] }),
});

interface Member {
  id: string;
  email: string;
  display_name: string | null;
  roles: AppRole[];
  created_at: string;
}
interface Invitation {
  id: string;
  email: string;
  role: AppRole;
  token: string;
  used_at: string | null;
  used_by: string | null;
  expires_at: string;
  created_at: string;
}

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administratör",
  saljare: "Säljare",
  ekonomi: "Ekonomi",
  arbetsledare: "Arbetsledare",
  hantverkare: "Hantverkare",
  underentreprenor: "Underentreprenör",
  viewer: "Viewer",
};

/** Roller grupperade per arbetsyta så admin ser vilken sida rollen ger tillgång till. */
const EXTERN_ROLES: AppRole[] = ["saljare"];
const INTERN_ROLES: AppRole[] = ["arbetsledare", "hantverkare", "underentreprenor"];
const OTHER_ROLES: AppRole[] = ["admin", "ekonomi", "viewer"];
const ALL_ROLES: AppRole[] = [...OTHER_ROLES, ...EXTERN_ROLES, ...INTERN_ROLES];

const roleLabel = (r: AppRole) => ROLE_LABELS[r] ?? r;

const roleVariant = (r: AppRole): "default" | "secondary" | "outline" =>
  r === "admin" ? "default" : r === "saljare" || r === "ekonomi" ? "secondary" : "outline";

function AdminPage() {
  const { user } = useAuth();
  const { isAdmin, loading: rolesLoading } = useUserRoles();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("saljare");
  const [creating, setCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  // Confirm dialogs
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<Invitation | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [profilesRes, rolesRes, invitesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, display_name, created_at")
        .order("created_at"),
      supabase.from("user_roles").select("user_id, role"),
      isAdmin
        ? supabase.from("invitations").select("*").order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
    ]);
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
    setInvitations(((invitesRes as any).data ?? []) as Invitation[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!rolesLoading) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesLoading, isAdmin]);

  /**
   * Slår på/av en enskild roll. Ett konto kan ha flera roller samtidigt
   * (t.ex. säljare på extern + hantverkare på intern). Vi rör aldrig
   * användarens övriga roller, så en misslyckad ändring kan inte längre
   * lämna kontot helt utan åtkomst.
   */
  const toggleMemberRole = async (userId: string, role: AppRole, enabled: boolean) => {
    // Optimistisk uppdatering så UI:t inte hoppar tillbaka
    setMembers((prev) =>
      prev.map((m) =>
        m.id === userId
          ? {
              ...m,
              roles: enabled
                ? Array.from(new Set([...m.roles, role]))
                : m.roles.filter((r) => r !== role),
            }
          : m,
      ),
    );

    const { error } = enabled
      ? await supabase.from("user_roles").upsert(
          { user_id: userId, role },
          { onConflict: "user_id,role", ignoreDuplicates: true },
        )
      : await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);

    if (error) {
      toast.error("Kunde inte uppdatera roll: " + error.message);
    } else {
      toast.success(
        enabled ? `${roleLabel(role)} tillagd` : `${roleLabel(role)} borttagen`,
      );
    }
    loadData();
  };

  const removeMember = async (userId: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (error) toast.error(error.message);
    else toast.success("Åtkomst borttagen");
    setConfirmRemove(null);
    loadData();
  };

  const createInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setCreating(true);
    try {
      const { sendEmployeeInvite } = await import("@/lib/employee-invite.functions");
      const res = await sendEmployeeInvite({
        data: {
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole as any,
          redirectTo: `${window.location.origin}/accept-invite`,
        },
      });
      // Hämta nyaste token för fallback-länk
      const { data: invRow } = await supabase
        .from("invitations")
        .select("token")
        .eq("email", inviteEmail.trim().toLowerCase())
        .is("used_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setCreatedToken((invRow as any)?.token ?? null);
      if (res?.alreadyRegistered) {
        toast.info("E-posten är redan registrerad – ingen ny inbjudan skickad");
      } else {
        toast.success("Inbjudningsmail skickat");
      }
      loadData();
    } catch (err: any) {
      toast.error(err?.message ?? "Kunde inte skicka inbjudan");
    } finally {
      setCreating(false);
    }
  };

  const closeInviteDialog = () => {
    setInviteOpen(false);
    setInviteEmail("");
    setInviteRole("saljare");
    setCreatedToken(null);
  };

  const revokeInvite = async (id: string) => {
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) toast.error(error.message);
    else toast.success("Inbjudan borttagen");
    setConfirmRevoke(null);
    loadData();
  };

  const resendInvite = async (inv: Invitation) => {
    try {
      const { sendEmployeeInvite } = await import("@/lib/employee-invite.functions");
      await sendEmployeeInvite({
        data: {
          email: inv.email,
          role: inv.role as any,
          redirectTo: `${window.location.origin}/accept-invite`,
        },
      });
      toast.success("Inbjudningsmail skickat igen");
      loadData();
    } catch (err: any) {
      toast.error(err?.message ?? "Kunde inte skicka inbjudan");
    }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/accept-invite?invite=${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Inbjudningslänk kopierad");
  };

  const inviteStatus = (inv: Invitation): "used" | "expired" | "pending" => {
    if (inv.used_at) return "used";
    if (new Date(inv.expires_at) <= new Date()) return "expired";
    return "pending";
  };

  const stats = useMemo(() => {
    const admins = members.filter((m) => m.roles.includes("admin")).length;
    const saljare = members.filter(
      (m) => m.roles.includes("saljare") && !m.roles.includes("admin")
    ).length;
    const viewers = members.filter(
      (m) => m.roles.includes("viewer") && !m.roles.includes("admin") && !m.roles.includes("saljare")
    ).length;
    const pending = invitations.filter((i) => inviteStatus(i) === "pending").length;
    return { admins, saljare, viewers, pending };
  }, [members, invitations]);

  if (rolesLoading) {
    return (
      <AppShell title="Medlemmar">
        <p className="text-muted-foreground">Laddar...</p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Medlemmar"
      description="Hantera vem som har åtkomst till admin.vt6 och vilka rättigheter de har."
      actions={
        isAdmin ? (
          <Button onClick={() => setInviteOpen(true)} size="sm">
            <UserPlus className="mr-2 h-4 w-4" /> Bjud in medlem
          </Button>
        ) : null
      }
    >
      <div className="space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={<Shield className="h-4 w-4" />} label="Administratörer" value={stats.admins} />
          <StatCard icon={<Users className="h-4 w-4" />} label="Säljare" value={stats.saljare} />
          <StatCard icon={<Users className="h-4 w-4" />} label="Viewers" value={stats.viewers} />
          <StatCard icon={<Mail className="h-4 w-4" />} label="Väntande inbjudningar" value={stats.pending} />
        </div>

        <Tabs defaultValue="members" className="space-y-4">
          <TabsList>
            <TabsTrigger value="members">
              <Users className="mr-2 h-4 w-4" /> Medlemmar ({members.length})
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="invitations">
                <Mail className="mr-2 h-4 w-4" /> Inbjudningar ({invitations.length})
              </TabsTrigger>
            )}
          </TabsList>

          {/* Members tab */}
          <TabsContent value="members">
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <p className="p-6 text-muted-foreground">Laddar...</p>
                ) : members.length === 0 ? (
                  <p className="p-6 text-muted-foreground">Inga medlemmar ännu.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Namn</TableHead>
                        <TableHead>E-post</TableHead>
                        <TableHead>Roll</TableHead>
                        <TableHead>Tillagd</TableHead>
                        {isAdmin && <TableHead className="text-right">Åtgärd</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((m) => {
                        const isSelf = m.id === user?.id;
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium">
                              {m.display_name ?? "—"}
                              {isSelf && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  Du
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{m.email}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {m.roles.length === 0 ? (
                                  <Badge variant="destructive">Ingen åtkomst</Badge>
                                ) : (
                                  m.roles.map((r) => (
                                    <Badge key={r} variant={roleVariant(r)}>
                                      {roleLabel(r)}
                                    </Badge>
                                  ))
                                )}
                                {isAdmin && !isSelf && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
                                        Ändra roller
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-56">
                                      <DropdownMenuLabel>Gemensamt</DropdownMenuLabel>
                                      {OTHER_ROLES.map((r) => (
                                        <DropdownMenuCheckboxItem
                                          key={r}
                                          checked={m.roles.includes(r)}
                                          onSelect={(e) => e.preventDefault()}
                                          onCheckedChange={(v) => toggleMemberRole(m.id, r, !!v)}
                                        >
                                          {roleLabel(r)}
                                        </DropdownMenuCheckboxItem>
                                      ))}
                                      <DropdownMenuSeparator />
                                      <DropdownMenuLabel>Extern (sälj)</DropdownMenuLabel>
                                      {EXTERN_ROLES.map((r) => (
                                        <DropdownMenuCheckboxItem
                                          key={r}
                                          checked={m.roles.includes(r)}
                                          onSelect={(e) => e.preventDefault()}
                                          onCheckedChange={(v) => toggleMemberRole(m.id, r, !!v)}
                                        >
                                          {roleLabel(r)}
                                        </DropdownMenuCheckboxItem>
                                      ))}
                                      <DropdownMenuSeparator />
                                      <DropdownMenuLabel>Intern (personal)</DropdownMenuLabel>
                                      {INTERN_ROLES.map((r) => (
                                        <DropdownMenuCheckboxItem
                                          key={r}
                                          checked={m.roles.includes(r)}
                                          onSelect={(e) => e.preventDefault()}
                                          onCheckedChange={(v) => toggleMemberRole(m.id, r, !!v)}
                                        >
                                          {roleLabel(r)}
                                        </DropdownMenuCheckboxItem>
                                      ))}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {new Date(m.created_at).toLocaleDateString("sv-SE")}
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right">
                                {!isSelf && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setConfirmRemove(m)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invitations tab */}
          {isAdmin && (
            <TabsContent value="invitations">
              <Card>
                <CardContent className="p-0">
                  {invitations.length === 0 ? (
                    <div className="p-8 text-center">
                      <Mail className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        Inga inbjudningar ännu. Klicka på "Bjud in medlem" för att komma igång.
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>E-post</TableHead>
                          <TableHead>Roll</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Skapad</TableHead>
                          <TableHead>Går ut</TableHead>
                          <TableHead className="text-right">Åtgärd</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invitations.map((inv) => {
                          const status = inviteStatus(inv);
                          return (
                            <TableRow key={inv.id}>
                              <TableCell className="font-medium">{inv.email}</TableCell>
                              <TableCell>
                                <Badge variant={roleVariant(inv.role)}>{roleLabel(inv.role)}</Badge>
                              </TableCell>
                              <TableCell>
                                {status === "pending" && (
                                  <span className="inline-flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-500">
                                    <Clock className="h-3.5 w-3.5" /> Väntar
                                  </span>
                                )}
                                {status === "used" && (
                                  <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-500">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Accepterad
                                  </span>
                                )}
                                {status === "expired" && (
                                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <XCircle className="h-3.5 w-3.5" /> Utgången
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {new Date(inv.created_at).toLocaleDateString("sv-SE")}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {new Date(inv.expires_at).toLocaleDateString("sv-SE")}
                              </TableCell>
                              <TableCell className="text-right space-x-1">
                                {status === "pending" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copyInviteLink(inv.token)}
                                  >
                                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Kopiera länk
                                  </Button>
                                )}
                                {status === "expired" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => resendInvite(inv)}
                                  >
                                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Förnya
                                  </Button>
                                )}
                                {status !== "used" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setConfirmRevoke(inv)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={(o) => (o ? setInviteOpen(true) : closeInviteDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bjud in ny medlem</DialogTitle>
            <DialogDescription>
              {createdToken
                ? "Inbjudningsmail skickat! Mottagaren får en länk till en sida där de väljer namn och lösenord. Du kan också kopiera reservlänken nedan."
                : "Vi mailar mottagaren en länk till en sida där de skapar sitt konto."}
            </DialogDescription>
          </DialogHeader>

          {!createdToken ? (
            <form onSubmit={createInvite} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">E-post</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="namn@företag.se"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>Roll</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administratör – full åtkomst</SelectItem>
                    <SelectItem value="saljare">Säljare – kan redigera leads</SelectItem>
                    <SelectItem value="ekonomi">Ekonomi – löner, fakturor & ROT</SelectItem>
                    <SelectItem value="viewer">Viewer – endast läsa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeInviteDialog}>
                  Avbryt
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? "Skapar..." : "Skapa inbjudan"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Inbjudningslänk</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/accept-invite?invite=${createdToken}`}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => copyInviteLink(createdToken)}
                  >
                    <Link2 className="mr-1.5 h-4 w-4" /> Kopiera
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Länken är giltig i 14 dagar.</p>
              </div>
              <DialogFooter>
                <Button onClick={closeInviteDialog}>Klar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm remove member */}
      <AlertDialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort åtkomst?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRemove?.email} kommer inte längre kunna logga in på admin.vt6.
              Användarens konto raderas inte – du kan ge åtkomst igen senare.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmRemove && removeMember(confirmRemove.id)}>
              Ta bort åtkomst
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm revoke invite */}
      <AlertDialog open={!!confirmRevoke} onOpenChange={(o) => !o && setConfirmRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort inbjudan?</AlertDialogTitle>
            <AlertDialogDescription>
              Inbjudningslänken till {confirmRevoke?.email} kommer sluta fungera.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmRevoke && revokeInvite(confirmRevoke.id)}>
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
