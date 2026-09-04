import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  createQuickPriceItem,
  deleteQuickPriceItem,
  fetchQuickPriceItems,
  fetchQuickPriceSettings,
  updateQuickPriceItem,
  updateQuickPriceSettings,
  type QuickPriceItem,
  type QuickKind,
  type QuickService,
  type QuickUnit,
} from "@/lib/quick-price";

const SERVICE_LABEL: Record<QuickService, string> = {
  takbyte: "Takbyte",
  taktvatt: "Taktvätt",
};
const KIND_LABEL: Record<QuickKind, string> = {
  material: "Material / grundpris",
  arbete: "Arbete",
  tillval: "Tillval",
  svarighet: "Våningar / åtkomst (påslag %)",
  lutning: "Lutning (påslag % på arbete)",
};
const KINDS: QuickKind[] = ["material", "arbete", "tillval", "svarighet", "lutning"];
const UNITS: QuickUnit[] = ["kvm", "st", "procent", "fast", "lpm"];

export function QuickPriceAdmin() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    service: "takbyte" as QuickService,
    kind: "tillval" as QuickKind,
    key: "",
    label: "",
    unit: "kvm" as QuickUnit,
    unit_price: 0,
    is_active: true,
    sort_order: 100,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["quick-price-items"],
    queryFn: fetchQuickPriceItems,
  });
  const { data: settings } = useQuery({
    queryKey: ["quick-price-settings"],
    queryFn: fetchQuickPriceSettings,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["quick-price-items"] });
    qc.invalidateQueries({ queryKey: ["quick-price-settings"] });
  };

  const createM = useMutation({
    mutationFn: createQuickPriceItem,
    onSuccess: () => {
      toast.success("Rad tillagd");
      setAdding(false);
      setDraft({ ...draft, key: "", label: "", unit_price: 0 });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Fel"),
  });
  const updateM = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<QuickPriceItem> }) =>
      updateQuickPriceItem(id, patch),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Fel"),
  });
  const deleteM = useMutation({
    mutationFn: deleteQuickPriceItem,
    onSuccess: () => {
      toast.success("Rad borttagen");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Fel"),
  });
  const settingsM = useMutation({
    mutationFn: updateQuickPriceSettings,
    onSuccess: () => {
      toast.success("Inställningar sparade");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Fel"),
  });

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Generella inställningar</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          {([
            ["moms_procent", "Moms (%)"],
            ["rot_procent", "ROT (%)"],
            ["rot_tak_per_agare", "ROT-tak/ägare (kr)"],
            ["taktvatt_min_pris", "Minpris taktvätt (kr)"],
          ] as const).map(([field, label]) => (
            <div key={field}>
              <Label>{label}</Label>
              <Input
                type="number"
                defaultValue={settings?.[field] ?? 0}
                onBlur={(e) => {
                  const v = Number(e.target.value) || 0;
                  if (settings && v !== settings[field]) settingsM.mutate({ [field]: v } as any);
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAdding((v) => !v)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Ny rad
        </Button>
      </div>

      {adding && (
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div>
              <Label>Tjänst</Label>
              <Select
                value={draft.service}
                onValueChange={(v) => setDraft({ ...draft, service: v as QuickService })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SERVICE_LABEL) as QuickService[]).map((s) => (
                    <SelectItem key={s} value={s}>{SERVICE_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Typ</Label>
              <Select
                value={draft.kind}
                onValueChange={(v) => setDraft({ ...draft, kind: v as QuickKind })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KINDS.map((k) => (
                    <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2">
              <Label>Etikett</Label>
              <Input
                value={draft.label}
                onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                placeholder="t.ex. Takfönster"
              />
            </div>
            <div>
              <Label>Enhet</Label>
              <Select
                value={draft.unit}
                onValueChange={(v) => setDraft({ ...draft, unit: v as QuickUnit })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pris / värde</Label>
              <Input
                type="number"
                value={draft.unit_price || ""}
                onChange={(e) => setDraft({ ...draft, unit_price: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              disabled={!draft.label || createM.isPending}
              onClick={() =>
                createM.mutate({
                  ...draft,
                  key:
                    draft.key ||
                    draft.label
                      .toLowerCase()
                      .replace(/[åä]/g, "a")
                      .replace(/ö/g, "o")
                      .replace(/[^a-z0-9]+/g, "_")
                      .replace(/^_|_$/g, ""),
                })
              }
            >
              {createM.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Spara
            </Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>Avbryt</Button>
          </div>
        </section>
      )}

      {(Object.keys(SERVICE_LABEL) as QuickService[]).map((service) => (
        <section key={service} className="space-y-3">
          <h3 className="text-sm font-semibold">{SERVICE_LABEL[service]}</h3>
          {KINDS.map((kind) => {
            const rows = items.filter((i) => i.service === service && i.kind === kind);
            if (rows.length === 0) return null;
            return (
              <div key={kind} className="rounded-lg border border-border bg-card">
                <div className="border-b border-border px-5 py-2 text-xs font-medium text-muted-foreground">
                  {KIND_LABEL[kind]}
                </div>
                <div className="divide-y divide-border">
                  {rows.map((r) => (
                    <QuickRow
                      key={r.id}
                      row={r}
                      onSave={(patch) => updateM.mutate({ id: r.id, patch })}
                      onDelete={() => {
                        if (confirm(`Ta bort ${r.label}?`)) deleteM.mutate(r.id);
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function QuickRow({
  row,
  onSave,
  onDelete,
}: {
  row: QuickPriceItem;
  onSave: (patch: Partial<QuickPriceItem>) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(row.label);
  const [price, setPrice] = useState(row.unit_price);
  const [active, setActive] = useState(row.is_active);
  const dirty = label !== row.label || price !== row.unit_price || active !== row.is_active;

  return (
    <div className="grid grid-cols-[1fr_110px_80px_auto_auto] items-center gap-3 px-5 py-3">
      <div>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-8" />
        <div className="mt-1 font-mono text-[10px] text-muted-foreground">{row.key}</div>
      </div>
      <Input
        type="number"
        value={price}
        onChange={(e) => setPrice(Number(e.target.value) || 0)}
        className="h-8"
      />
      <Badge variant="outline">/ {row.unit}</Badge>
      <div className="flex items-center gap-2">
        <Switch checked={active} onCheckedChange={setActive} />
        <span className="text-xs text-muted-foreground">{active ? "Aktiv" : "Dold"}</span>
      </div>
      <div className="flex gap-1">
        {dirty && (
          <Button size="sm" onClick={() => onSave({ label, unit_price: price, is_active: active })}>
            Spara
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
