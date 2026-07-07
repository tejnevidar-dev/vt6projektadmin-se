import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, type View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { sv } from "date-fns/locale";
import { toast } from "sonner";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles, type AppRole } from "@/hooks/use-role";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  listShareablePeople,
  updateCalendarEvent,
  type CalendarEvent,
  type ShareablePerson,
} from "@/lib/calendar-api";

export const Route = createFileRoute("/kalender")({
  component: () => (
    <RequireAuth>
      <KalenderPage />
    </RequireAuth>
  ),
});

const locales = { sv };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

const EXTERN_ROLES: AppRole[] = ["saljare", "admin"];
const INTERN_ROLES: AppRole[] = ["arbetsledare", "hantverkare", "underentreprenor", "admin"];

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  saljare: "Säljare",
  viewer: "Viewer",
  arbetsledare: "Arbetsledare",
  hantverkare: "Hantverkare",
  underentreprenor: "Underentreprenör",
};

const MESSAGES = {
  date: "Datum",
  time: "Tid",
  event: "Händelse",
  allDay: "Heldag",
  week: "Vecka",
  work_week: "Arbetsvecka",
  day: "Dag",
  month: "Månad",
  previous: "Föregående",
  next: "Nästa",
  yesterday: "Igår",
  tomorrow: "Imorgon",
  today: "Idag",
  agenda: "Agenda",
  noEventsInRange: "Inga händelser i intervallet.",
  showMore: (count: number) => `+${count} till`,
};

function KalenderPage() {
  const { user } = useAuth();
  const { side } = useWorkspace();
  const { isAdmin } = useUserRoles();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [people, setPeople] = useState<ShareablePerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState(() => emptyForm());

  const allowedRoles = side === "extern" ? EXTERN_ROLES : INTERN_ROLES;

  const filteredPeople = useMemo(
    () => people.filter((p) => p.roles.some((r) => allowedRoles.includes(r))),
    [people, allowedRoles]
  );

  async function refresh() {
    setLoading(true);
    try {
      const [ev, pp] = await Promise.all([listCalendarEvents(side), listShareablePeople()]);
      setEvents(ev);
      setPeople(pp);
    } catch (e: any) {
      toast.error("Kunde inte ladda kalendern", { description: e.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side]);

  function openCreate(start?: Date, end?: Date) {
    setEditing(null);
    setForm({ ...emptyForm(), start_at: toLocalInput(start ?? new Date()), end_at: toLocalInput(end ?? addHour(start ?? new Date())) });
    setDialogOpen(true);
  }

  function openEdit(ev: CalendarEvent) {
    setEditing(ev);
    setForm({
      title: ev.title,
      description: ev.description ?? "",
      location: ev.location ?? "",
      start_at: toLocalInput(new Date(ev.start_at)),
      end_at: toLocalInput(new Date(ev.end_at)),
      all_day: ev.all_day,
      shared_users: ev.shared_users,
      shared_roles: ev.shared_roles,
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.title.trim()) {
      toast.error("Titel krävs");
      return;
    }
    try {
      const payload = {
        side,
        title: form.title.trim(),
        description: form.description || null,
        location: form.location || null,
        start_at: new Date(form.start_at).toISOString(),
        end_at: new Date(form.end_at).toISOString(),
        all_day: form.all_day,
        shared_users: form.shared_users,
        shared_roles: form.shared_roles,
      };
      if (editing) {
        await updateCalendarEvent(editing.id, payload);
        toast.success("Händelse uppdaterad");
      } else {
        await createCalendarEvent(payload);
        toast.success("Händelse skapad");
      }
      setDialogOpen(false);
      refresh();
    } catch (e: any) {
      toast.error("Kunde inte spara", { description: e.message });
    }
  }

  async function remove() {
    if (!editing) return;
    if (!confirm("Ta bort händelsen?")) return;
    try {
      await deleteCalendarEvent(editing.id);
      toast.success("Händelse borttagen");
      setDialogOpen(false);
      refresh();
    } catch (e: any) {
      toast.error("Kunde inte ta bort", { description: e.message });
    }
  }

  const rbcEvents = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: new Date(e.start_at),
        end: new Date(e.end_at),
        allDay: e.all_day,
        resource: e,
      })),
    [events]
  );

  const canEditEditing = !editing || editing.owner_id === user?.id || isAdmin;

  return (
    <AppShell
      title="Kalender"
      description={`${side === "extern" ? "Extern" : "Intern"} kalender – separat från motsatt arbetsyta`}
      actions={<Button onClick={() => openCreate()}>Ny händelse</Button>}
    >
      <div className="rounded-lg border border-border bg-card p-3">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Laddar…</div>
        ) : (
          <div style={{ height: 720 }}>
            <Calendar
              localizer={localizer}
              culture="sv"
              messages={MESSAGES}
              events={rbcEvents}
              startAccessor="start"
              endAccessor="end"
              view={view}
              onView={setView}
              date={date}
              onNavigate={setDate}
              views={["month", "week", "day", "agenda"]}
              selectable
              onSelectSlot={(slot) => openCreate(slot.start as Date, slot.end as Date)}
              onSelectEvent={(ev: any) => openEdit(ev.resource as CalendarEvent)}
              popup
            />
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Redigera händelse" : "Ny händelse"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Titel</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} disabled={!canEditEditing} />
            </div>
            <div>
              <Label>Plats / adress</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} disabled={!canEditEditing} />
            </div>
            <div>
              <Label>Beskrivning</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={!canEditEditing} rows={3} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="allday" checked={form.all_day} onCheckedChange={(v) => setForm({ ...form, all_day: !!v })} disabled={!canEditEditing} />
              <Label htmlFor="allday" className="cursor-pointer">Heldag</Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Start</Label>
                <Input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} disabled={!canEditEditing} />
              </div>
              <div>
                <Label>Slut</Label>
                <Input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} disabled={!canEditEditing} />
              </div>
            </div>

            <div>
              <Label>Dela med roller</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {allowedRoles.map((role) => {
                  const checked = form.shared_roles.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      disabled={!canEditEditing}
                      onClick={() =>
                        setForm({
                          ...form,
                          shared_roles: checked
                            ? form.shared_roles.filter((r) => r !== role)
                            : [...form.shared_roles, role],
                        })
                      }
                      className={`rounded-md border px-2.5 py-1 text-xs ${checked ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      {ROLE_LABELS[role]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label>Dela med personer</Label>
              <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {filteredPeople.length === 0 && (
                  <div className="text-xs text-muted-foreground">Inga personer tillgängliga.</div>
                )}
                {filteredPeople.map((p) => {
                  const checked = form.shared_users.includes(p.id);
                  return (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        disabled={!canEditEditing}
                        onCheckedChange={(v) =>
                          setForm({
                            ...form,
                            shared_users: v
                              ? [...form.shared_users, p.id]
                              : form.shared_users.filter((u) => u !== p.id),
                          })
                        }
                      />
                      <span className="flex-1">{p.name}</span>
                      <span className="flex gap-1">
                        {p.roles.filter((r) => allowedRoles.includes(r)).map((r) => (
                          <Badge key={r} variant="outline" className="text-[10px]">{ROLE_LABELS[r]}</Badge>
                        ))}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {editing && (
              <div className="text-xs text-muted-foreground">
                Skapad av {editing.owner_name ?? "okänd"}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            {editing && canEditEditing && (
              <Button variant="destructive" onClick={remove} className="mr-auto">Ta bort</Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Stäng</Button>
            {canEditEditing && <Button onClick={save}>{editing ? "Spara" : "Skapa"}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function emptyForm() {
  const now = new Date();
  return {
    title: "",
    description: "",
    location: "",
    start_at: toLocalInput(now),
    end_at: toLocalInput(addHour(now)),
    all_day: false,
    shared_users: [] as string[],
    shared_roles: [] as AppRole[],
  };
}

function addHour(d: Date) {
  return new Date(d.getTime() + 60 * 60 * 1000);
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
