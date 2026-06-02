import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { BookOpen, Video, Save, Loader2 } from "lucide-react";
import {
  listSelfCheckInstructions,
  upsertSelfCheckInstruction,
  type SelfCheckInstructionRow,
} from "@/lib/jobs-api";
import { SELF_CHECK_TEMPLATES, type SelfCheckTemplate } from "@/lib/self-check-templates";
import { useUserRoles } from "@/hooks/use-role";

export const Route = createFileRoute("/egenkontroller/instruktioner")({
  component: () => (
    <RequireAuth>
      <InstructionsAdminPage />
    </RequireAuth>
  ),
});

type Key = string; // `${template_key}::${field_label}` ('' for template-level)
const keyOf = (tplKey: string, fieldLabel: string | null) =>
  `${tplKey}::${fieldLabel ?? ""}`;

function defaultInstructionFor(tpl: SelfCheckTemplate, fieldLabel: string | null): string {
  if (fieldLabel === null) return tpl.instructions ?? "";
  const f = tpl.fields.find((x) => x.label === fieldLabel);
  return f?.instruction ?? "";
}

function InstructionsAdminPage() {
  const { isAdmin } = useUserRoles();
  const [rows, setRows] = useState<SelfCheckInstructionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<Key, string>>({});
  const [saving, setSaving] = useState<Record<Key, boolean>>({});

  async function load() {
    setLoading(true);
    try {
      setRows(await listSelfCheckInstructions());
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const stored = useMemo(() => {
    const m: Record<Key, string> = {};
    for (const r of rows) {
      m[keyOf(r.template_key, r.field_label && r.field_label !== "" ? r.field_label : null)] =
        r.instruction;
    }
    return m;
  }, [rows]);

  const valueFor = (tpl: SelfCheckTemplate, fieldLabel: string | null): string => {
    const k = keyOf(tpl.key, fieldLabel);
    if (edits[k] !== undefined) return edits[k];
    if (stored[k] !== undefined) return stored[k];
    return defaultInstructionFor(tpl, fieldLabel);
  };

  const isDirty = (tpl: SelfCheckTemplate, fieldLabel: string | null) => {
    const k = keyOf(tpl.key, fieldLabel);
    return edits[k] !== undefined && edits[k] !== (stored[k] ?? defaultInstructionFor(tpl, fieldLabel));
  };

  async function save(tpl: SelfCheckTemplate, fieldLabel: string | null) {
    const k = keyOf(tpl.key, fieldLabel);
    const value = edits[k] ?? "";
    setSaving((s) => ({ ...s, [k]: true }));
    try {
      await upsertSelfCheckInstruction({
        template_key: tpl.key,
        field_label: fieldLabel,
        instruction: value,
      });
      toast.success("Instruktion sparad");
      setEdits((e) => {
        const n = { ...e };
        delete n[k];
        return n;
      });
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving((s) => ({ ...s, [k]: false }));
    }
  }

  return (
    <AppShell
      title="Hantera instruktioner"
      description="Redigera instruktionstexten för varje moment i mallarna. Det du skriver här visas både inne i egenkontrollen på projektet och i översikten nedan."
    >
      {!isAdmin && (
        <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Endast administratörer kan spara ändringar. Du kan läsa texterna men inte ändra dem.
        </div>
      )}

      <div className="mb-6 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
          <BookOpen className="h-4 w-4" />
          Så här fungerar det
        </div>
        <p>
          För varje mall finns en övergripande instruktion samt en textruta per moment.
          Lämna tom för att använda standardtexten. Bilder laddas inte upp här – det görs på
          projektets egenkontroll-flik där varje moment har sin egen bilduppladdning.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Laddar instruktioner...
        </div>
      ) : (
        <div className="space-y-8">
          {SELF_CHECK_TEMPLATES.map((tpl) => (
            <section
              key={tpl.key}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <div className="border-b border-border bg-muted/40 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-base font-semibold">{tpl.name}</h3>
                  <span className="text-xs text-muted-foreground">
                    {tpl.sentToClient ? "Skickas till beställaren" : "Intern – endast för oss"}
                  </span>
                </div>
                {tpl.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{tpl.description}</p>
                )}
                {tpl.videoUrl && (
                  <a
                    href={tpl.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <Video className="h-3.5 w-3.5" />
                    {tpl.videoLabel ?? "Se instruktionsvideo"}
                  </a>
                )}
              </div>

              {/* Template-level instruction */}
              <InstructionRow
                title="Övergripande instruktion"
                subtitle="Visas högst upp i mallen."
                value={valueFor(tpl, null)}
                dirty={isDirty(tpl, null)}
                saving={!!saving[keyOf(tpl.key, null)]}
                disabled={!isAdmin}
                onChange={(v) =>
                  setEdits((e) => ({ ...e, [keyOf(tpl.key, null)]: v }))
                }
                onSave={() => save(tpl, null)}
                emphasized
              />

              <ul className="divide-y divide-border">
                {tpl.fields.map((f) => (
                  <li key={f.label} className="px-4 py-4">
                    <div className="mb-2">
                      <div className="text-sm font-semibold">{f.label}</div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
                        {f.type === "checkbox"
                          ? "Avbockningspunkt"
                          : f.type === "text"
                          ? "Kort textsvar"
                          : "Långt textsvar"}
                      </div>
                    </div>
                    <InstructionRow
                      value={valueFor(tpl, f.label)}
                      dirty={isDirty(tpl, f.label)}
                      saving={!!saving[keyOf(tpl.key, f.label)]}
                      disabled={!isAdmin}
                      onChange={(v) =>
                        setEdits((e) => ({ ...e, [keyOf(tpl.key, f.label)]: v }))
                      }
                      onSave={() => save(tpl, f.label)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function InstructionRow({
  title,
  subtitle,
  value,
  dirty,
  saving,
  disabled,
  onChange,
  onSave,
  emphasized,
}: {
  title?: string;
  subtitle?: string;
  value: string;
  dirty: boolean;
  saving: boolean;
  disabled?: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
  emphasized?: boolean;
}) {
  return (
    <div className={emphasized ? "border-b border-border bg-primary/5 px-4 py-3" : ""}>
      {title && (
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
          {title}
        </div>
      )}
      {subtitle && (
        <div className="mb-1 text-[11px] text-muted-foreground">{subtitle}</div>
      )}
      <Textarea
        value={value}
        rows={3}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Skriv instruktion..."
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        {dirty && (
          <span className="text-[11px] text-muted-foreground">Ej sparad ändring</span>
        )}
        <Button
          size="sm"
          variant={dirty ? "default" : "outline"}
          disabled={disabled || !dirty || saving}
          onClick={onSave}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Spara
        </Button>
      </div>
    </div>
  );
}
