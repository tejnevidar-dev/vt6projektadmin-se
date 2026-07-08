import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { Calendar, dateFnsLocalizer, type View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { sv } from "date-fns/locale";
import { toast } from "sonner";
import { Plus, X, Check } from "lucide-react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useUserRoles, type AppRole } from "@/hooks/use-role";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  listCustomerOptions,
  listShareablePeople,
  updateCalendarEvent,
  updateEventAgenda,
  type AgendaItem,
  type CalendarEvent,
  type CalendarEventInput,
  type CustomerOption,
  type ShareablePerson,
} from "@/lib/calendar-api";

const searchSchema = z.object({
  customer: z.string().optional().catch(undefined),
  view: z.enum(["month", "week", "day", "agenda"]).optional().catch("month"),
  date: z.string().optional().catch(undefined),
});

type Search = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/kalender")({
  validateSearch: zodValidator(searchSchema),
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

type CustomerFilter = { kind: "lead" | "job"; id: string } | null;

const EMPTY_EVENTS: CalendarEvent[] = [];
const EMPTY_PEOPLE: ShareablePerson[] = [];
const EMPTY_CUSTOMERS: CustomerOption[] = [];

function KalenderPage() {
  const { user } = useAuth();
  const { side } = useWorkspace();
  const { isAdmin } = useUserRoles();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/kalender" });
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState(() => emptyForm());
  const [newAgendaText, setNewAgendaText] = useState("");
  const [agendaToDelete, setAgendaToDelete] = useState<{ event: CalendarEvent; item: AgendaItem } | null>(null);
  const [editingAgendaItem, setEditingAgendaItem] = useState<{ event: CalendarEvent; item: AgendaItem } | null>(null);
  const [editAgendaText, setEditAgendaText] = useState("");

  const customerFilter: CustomerFilter = useMemo(() => {
    if (!search.customer || search.customer === "__all__") return null;
    const [kind, ...rest] = search.customer.split(":");
    if (kind !== "lead" && kind !== "job") return null;
    return { kind, id: rest.join(":") };
  }, [search.customer]);

  const view = useMemo<View>(() => (search.view ?? "month") as View, [search.view]);
  const date = useMemo(() => {
    if (search.date) {
      const [y, m, d] = search.date.split("-").map((n) => parseInt(n, 10));
      if (y && m && d) {
        return new Date(y, m - 1, d, 12, 0, 0);
      }
    }
    return new Date();
  }, [search.date]);

  const eventsQuery = useQuery({
    queryKey: ["calendar-events", side],
    queryFn: () => listCalendarEvents(side),
  });

  const peopleQuery = useQuery({
    queryKey: ["shareable-people"],
    queryFn: listShareablePeople,
  });

  const customersQuery = useQuery({
    queryKey: ["customer-options"],
    queryFn: listCustomerOptions,
  });

  const events = eventsQuery.data ?? EMPTY_EVENTS;
  const people = peopleQuery.data ?? EMPTY_PEOPLE;
  const customers = customersQuery.data ?? EMPTY_CUSTOMERS;
  const loading = eventsQuery.isLoading || peopleQuery.isLoading || customersQuery.isLoading;

  const allowedRoles = side === "extern" ? EXTERN_ROLES : INTERN_ROLES;

  const filteredPeople = useMemo(
    () => people.filter((p) => p.roles.some((r) => allowedRoles.includes(r))),
    [people, allowedRoles]
  );

  const updateAgendaMutation = useMutation({
    mutationFn: ({ id, agenda }: { id: string; agenda: AgendaItem[] }) => updateEventAgenda(id, agenda),
    onMutate: async ({ id, agenda }) => {
      await queryClient.cancelQueries({ queryKey: ["calendar-events", side] });
      const previous = queryClient.getQueryData<CalendarEvent[]>(["calendar-events", side]);
      queryClient.setQueryData<CalendarEvent[]>(["calendar-events", side], (old) =>
        old?.map((e) => (e.id === id ? { ...e, agenda } : e))
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["calendar-events", side], context.previous);
      }
      toast.error("Kunde inte spara agenda", { description: errorMessage(err) });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events", side] });
    },
  });

  const saveEventMutation = useMutation({
    mutationFn: async (payload: CalendarEventInput & { id?: string }) => {
      if (payload.id) {
        await updateCalendarEvent(payload.id, payload);
      } else {
        await createCalendarEvent(payload);
      }
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events", side] });
      toast.success(vars.id ? "Händelse uppdaterad" : "Händelse skapad");
      setDialogOpen(false);
    },
    onError: (err) => {
      toast.error("Kunde inte spara", { description: errorMessage(err) });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id: string) => deleteCalendarEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events", side] });
      toast.success("Händelse borttagen");
      setDialogOpen(false);
    },
    onError: (err) => {
      toast.error("Kunde inte ta bort", { description: errorMessage(err) });
    },
  });

  const displayedEvents = useMemo(() => {
    if (!customerFilter) return events;
    return events.filter((e) =>
      customerFilter.kind === "lead" ? e.lead_id === customerFilter.id : e.job_id === customerFilter.id
    );
  }, [events, customerFilter]);

  function setCustomerFilter(filter: CustomerFilter) {
    navigate({
      search: (prev: Search) => ({ ...prev, customer: filter ? `${filter.kind}:${filter.id}` : "__all__" }),
    });
  }

  function setViewValue(v: View) {
    navigate({ search: (prev: Search) => ({ ...prev, view: v }) });
  }

  function setDateValue(d: Date) {
    navigate({ search: (prev: Search) => ({ ...prev, date: format(d, "yyyy-MM-dd") }) });
  }

  async function toggleAgendaItem(ev: CalendarEvent, itemId: string) {
    const nextAgenda = (ev.agenda ?? []).map((a) => (a.id === itemId ? { ...a, done: !a.done } : a));
    await updateAgendaMutation.mutateAsync({ id: ev.id, agenda: nextAgenda });
  }

  async function addAgendaItem(ev: CalendarEvent, text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const item: AgendaItem = { id: generateId(), text: trimmed, done: false };
    const nextAgenda = [...(ev.agenda ?? []), item];
    await updateAgendaMutation.mutateAsync({ id: ev.id, agenda: nextAgenda });
  }

  async function removeAgendaItem(ev: CalendarEvent, itemId: string) {
    const nextAgenda = (ev.agenda ?? []).filter((a) => a.id !== itemId);
    await updateAgendaMutation.mutateAsync({ id: ev.id, agenda: nextAgenda });
  }

  function confirmRemoveAgendaItem() {
    if (!agendaToDelete) return;
    const { event, item } = agendaToDelete;
    setAgendaToDelete(null);
    removeAgendaItem(event, item.id);
  }

  function startEditingAgendaItem(ev: CalendarEvent, item: AgendaItem) {
    setEditingAgendaItem({ event: ev, item });
    setEditAgendaText(item.text);
  }

  function cancelAgendaItemEdit() {
    setEditingAgendaItem(null);
    setEditAgendaText("");
  }

  async function commitAgendaItemEdit() {
    if (!editingAgendaItem) return;
    const { event, item } = editingAgendaItem;
    const trimmed = editAgendaText.trim();
    if (!trimmed || trimmed === item.text) {
      cancelAgendaItemEdit();
      return;
    }
    const nextAgenda = (event.agenda ?? []).map((a) => (a.id === item.id ? { ...a, text: trimmed } : a));
    cancelAgendaItemEdit();
    await updateAgendaMutation.mutateAsync({ id: event.id, agenda: nextAgenda });
  }

  function openCreate(start?: Date, end?: Date) {
    setEditing(null);
    const base = emptyForm();
    setForm({
      ...base,
      start_at: toLocalInput(start ?? new Date()),
      end_at: toLocalInput(end ?? addHour(start ?? new Date())),
      lead_id: customerFilter?.kind === "lead" ? customerFilter.id : null,
      job_id: customerFilter?.kind === "job" ? customerFilter.id : null,
    });
    setNewAgendaText("");
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
      lead_id: ev.lead_id,
      job_id: ev.job_id,
      agenda: ev.agenda ?? [],
      shared_users: ev.shared_users,
      shared_roles: ev.shared_roles,
    });
    setNewAgendaText("");
    setDialogOpen(true);
  }

  async function save() {
    if (!form.title.trim()) {
      toast.error("Titel krävs");
      return;
    }
    const payload: CalendarEventInput & { id?: string } = {
      side,
      title: form.title.trim(),
      description: form.description || null,
      location: form.location || null,
      lead_id: form.lead_id,
      job_id: form.job_id,
      start_at: new Date(form.start_at).toISOString(),
      end_at: new Date(form.end_at).toISOString(),
      all_day: form.all_day,
      agenda: form.agenda,
      shared_users: form.shared_users,
      shared_roles: form.shared_roles,
    };
    if (editing) {
      payload.id = editing.id;
    }
    await saveEventMutation.mutateAsync(payload);
  }

  async function remove() {
    if (!editing) return;
    if (!confirm("Ta bort händelsen?")) return;
    await deleteEventMutation.mutateAsync(editing.id);
  }

  const rbcEvents = useMemo(
    () =>
      displayedEvents.map((e) => ({
        id: e.id,
        title: e.title,
        start: new Date(e.start_at),
        end: new Date(e.end_at),
        allDay: e.all_day,
        resource: e,
      })),
    [displayedEvents]
  );

  const canEditEditing = !editing || editing.owner_id === user?.id || isAdmin;

  function setCustomer(value: string) {
    if (value === "__all__") {
      setCustomerFilter(null);
    } else {
      const [kind, ...rest] = value.split(":");
      setCustomerFilter({ kind: kind as "lead" | "job", id: rest.join(":") });
    }
  }

  function setEventCustomer(value: string) {
    if (value === "__none__") {
      setForm({ ...form, lead_id: null, job_id: null });
    } else {
      const [kind, ...rest] = value.split(":");
      const id = rest.join(":");
      if (kind === "lead") setForm({ ...form, lead_id: id, job_id: null });
      else setForm({ ...form, lead_id: null, job_id: id });
    }
  }

  const eventCustomerValue =
    form.lead_id ? `lead:${form.lead_id}` : form.job_id ? `job:${form.job_id}` : "__none__";

  const filterValue = customerFilter ? `${customerFilter.kind}:${customerFilter.id}` : "__all__";

  const selectedCustomer = customerFilter
    ? customers.find((c) => c.kind === customerFilter.kind && c.id === customerFilter.id) ?? null
    : null;

  function addFormAgendaItem() {
    const text = newAgendaText.trim();
    if (!text) return;
    const item: AgendaItem = { id: generateId(), text, done: false };
    setForm({ ...form, agenda: [...form.agenda, item] });
    setNewAgendaText("");
  }

  function toggleAgenda(id: string) {
    setForm({
      ...form,
      agenda: form.agenda.map((a) => (a.id === id ? { ...a, done: !a.done } : a)),
    });
  }

  function removeAgenda(id: string) {
    setForm({ ...form, agenda: form.agenda.filter((a) => a.id !== id) });
  }

  return (
    <AppShell
      title="Kalender"
      description={`${side === "extern" ? "Extern" : "Intern"} kalender – separat från motsatt arbetsyta`}
      actions={<Button onClick={() => openCreate()}>Ny händelse</Button>}
    >
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Filtrera kund</Label>
          <Select value={filterValue} onValueChange={setCustomer}>
            <SelectTrigger className="h-9 w-[280px]">
              <SelectValue placeholder="Alla kunder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alla kunder</SelectItem>
              {customers.filter((c) => c.kind === "lead").length > 0 && (
                <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">Leads</div>
              )}
              {customers
                .filter((c) => c.kind === "lead")
                .map((c) => (
                  <SelectItem key={`lead:${c.id}`} value={`lead:${c.id}`}>
                    {c.label}
                    {c.sub ? ` · ${c.sub}` : ""}
                  </SelectItem>
                ))}
              {customers.filter((c) => c.kind === "job").length > 0 && (
                <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">Jobb</div>
              )}
              {customers
                .filter((c) => c.kind === "job")
                .map((c) => (
                  <SelectItem key={`job:${c.id}`} value={`job:${c.id}`}>
                    {c.label}
                    {c.sub ? ` · ${c.sub}` : ""}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {customerFilter && (
            <Button size="sm" variant="ghost" onClick={() => setCustomerFilter(null)}>
              Rensa
            </Button>
          )}
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {displayedEvents.length} händelse{displayedEvents.length === 1 ? "" : "r"}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
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
                onView={setViewValue}
                date={date}
                onNavigate={setDateValue}
                views={["month", "week", "day", "agenda"]}
                selectable
                onSelectSlot={(slot) => openCreate(slot.start as Date, slot.end as Date)}
                onSelectEvent={(ev) => openEdit((ev as { resource: CalendarEvent }).resource)}
                popup
              />
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Agenda</h3>
            {selectedCustomer && (
              <Badge variant="outline" className="text-[10px]">
                {selectedCustomer.kind === "lead" ? "Lead" : "Jobb"}
              </Badge>
            )}
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            {selectedCustomer
              ? `Kommande & senaste för ${selectedCustomer.label}`
              : "Välj en kund i filtret för att se agendan"}
          </p>
          <div className="space-y-3 max-h-[660px] overflow-y-auto">
            {displayedEvents.length === 0 && (
              <div className="text-xs text-muted-foreground">Inga händelser.</div>
            )}
            {displayedEvents.map((e) => (
              <div
                key={e.id}
                className="rounded-md border border-border p-3 hover:bg-muted/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => openEdit(e)}
                    className="font-medium text-sm text-left hover:underline"
                  >
                    {e.title}
                  </button>
                  <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {format(new Date(e.start_at), "d MMM HH:mm", { locale: sv })}
                  </div>
                </div>
                {e.location && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">{e.location}</div>
                )}
                {e.agenda && e.agenda.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {e.agenda.map((a) => (
                      <li key={a.id} className="flex items-start gap-2 text-xs group">
                        <Checkbox
                          checked={a.done}
                          onCheckedChange={() => toggleAgendaItem(e, a.id)}
                          className="mt-0.5"
                        />
                        {editingAgendaItem?.event.id === e.id && editingAgendaItem?.item.id === a.id ? (
                          <Input
                            value={editAgendaText}
                            onChange={(ev) => setEditAgendaText(ev.target.value)}
                            onKeyDown={(ev) => {
                              if (ev.key === "Enter") {
                                ev.preventDefault();
                                commitAgendaItemEdit();
                              } else if (ev.key === "Escape") {
                                ev.preventDefault();
                                cancelAgendaItemEdit();
                              }
                            }}
                            onBlur={commitAgendaItemEdit}
                            autoFocus
                            className="h-6 text-xs flex-1"
                          />
                        ) : (
                          <span
                            onClick={() => startEditingAgendaItem(e, a)}
                            className={`flex-1 cursor-pointer ${a.done ? "line-through text-muted-foreground" : ""}`}
                            title="Klicka för att redigera"
                          >
                            {a.text}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setAgendaToDelete({ event: e, item: a })}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                          aria-label="Ta bort punkt"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <AddAgendaInline onAdd={(text) => addAgendaItem(e, text)} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Redigera händelse" : "Ny händelse"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Titel</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} disabled={!canEditEditing} />
            </div>

            <div>
              <Label>Kund (lead eller jobb)</Label>
              <Select value={eventCustomerValue} onValueChange={setEventCustomer} disabled={!canEditEditing}>
                <SelectTrigger>
                  <SelectValue placeholder="Ingen kund" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Ingen kund</SelectItem>
                  {customers.filter((c) => c.kind === "lead").length > 0 && (
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">Leads</div>
                  )}
                  {customers
                    .filter((c) => c.kind === "lead")
                    .map((c) => (
                      <SelectItem key={`lead:${c.id}`} value={`lead:${c.id}`}>
                        {c.label}
                        {c.sub ? ` · ${c.sub}` : ""}
                      </SelectItem>
                    ))}
                  {customers.filter((c) => c.kind === "job").length > 0 && (
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">Jobb</div>
                  )}
                  {customers
                    .filter((c) => c.kind === "job")
                    .map((c) => (
                      <SelectItem key={`job:${c.id}`} value={`job:${c.id}`}>
                        {c.label}
                        {c.sub ? ` · ${c.sub}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Plats / adress</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} disabled={!canEditEditing} />
            </div>
            <div>
              <Label>Beskrivning</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} disabled={!canEditEditing} rows={3} />
            </div>

            <div>
              <Label>Agenda / punkter</Label>
              <div className="mt-1 space-y-1">
                {form.agenda.length === 0 && (
                  <div className="text-xs text-muted-foreground">Inga punkter ännu.</div>
                )}
                {form.agenda.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1">
                    <button
                      type="button"
                      onClick={() => toggleAgenda(a.id)}
                      disabled={!canEditEditing}
                      className={`flex h-5 w-5 items-center justify-center rounded border ${a.done ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                    >
                      {a.done && <Check className="h-3 w-3" />}
                    </button>
                    <span className={`flex-1 text-sm ${a.done ? "line-through text-muted-foreground" : ""}`}>{a.text}</span>
                    {canEditEditing && (
                      <button type="button" onClick={() => removeAgenda(a.id)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {canEditEditing && (
                <div className="mt-2 flex gap-2">
                  <Input
                    placeholder="Ny agendapunkt…"
                    value={newAgendaText}
                    onChange={(e) => setNewAgendaText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addFormAgendaItem();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={addFormAgendaItem}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
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

      <Dialog open={!!agendaToDelete} onOpenChange={(open) => !open && setAgendaToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ta bort agendapunkt?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Är du säker på att du vill ta bort "{agendaToDelete?.item.text}"?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAgendaToDelete(null)}>
              Avbryt
            </Button>
            <Button variant="destructive" onClick={confirmRemoveAgendaItem}>
              Ta bort
            </Button>
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
    lead_id: null as string | null,
    job_id: null as string | null,
    agenda: [] as AgendaItem[],
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

function generateId() {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && "randomUUID" in c && typeof (c as Crypto).randomUUID === "function") {
    return (c as Crypto).randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function AddAgendaInline({ onAdd }: { onAdd: (text: string) => void | Promise<void> }) {
  const [text, setText] = useState("");
  async function submit() {
    const t = text.trim();
    if (!t) return;
    setText("");
    await onAdd(t);
  }
  return (
    <div className="flex gap-1 mt-2">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Ny agendapunkt…"
        className="h-7 text-xs"
      />
      <Button type="button" variant="outline" size="icon" className="h-7 w-7" onClick={submit}>
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}
