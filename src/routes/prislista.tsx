import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Save, Trash2, Loader2 } from "lucide-react";
import { AppShell, RequireAuth } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useUserRoles } from "@/hooks/use-role";
import {
  fetchPriceList,
  createPriceRow,
  updatePriceRow,
  deletePriceRow,
  type PriceRowInput,
} from "@/lib/price-list-api";
import type { PriceRow, PriceCategory, PriceUnit } from "@/lib/calc-engine";
import { formatSek } from "@/lib/calc-engine";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuickPriceAdmin } from "@/components/QuickPriceAdmin";

export const Route = createFileRoute("/prislista")({
  component: () => (
    <RequireAuth>
      <PrislistaPage />
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Kalkyl – admin.vt6" }] }),
});

const CATEGORY_LABEL: Record<PriceCategory, string> = {
  material: "Material",
  arbete: "Arbete",
  plat: "Plåt",
  tillagg: "Tillägg",
};
const UNITS: PriceUnit[] = ["kvm", "meter", "st", "timme", "paket"];
const CATEGORIES: PriceCategory[] = ["material", "plat", "arbete", "tillagg"];

function PrislistaPage() {
  const { isAdmin, loading } = useUserRoles();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<PriceRowInput>({
    category: "material", key: "", label: "", unit: "kvm", unit_price: 0, is_active: true, sort_order: 0,
  });

  const { data: rows = [], isLoading } = useQuery({ queryKey: ["price-list-all"], queryFn: fetchPriceList });

  const createM = useMutation({
    mutationFn: (input: PriceRowInput) => createPriceRow(input),
    onSuccess: () => { toast.success("Rad tillagd"); setAdding(false); qc.invalidateQueries({ queryKey: ["price-list-all"] }); qc.invalidateQueries({ queryKey: ["price-list-active"] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });
  const updateM = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<PriceRowInput> }) => updatePriceRow(id, patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["price-list-all"] }); qc.invalidateQueries({ queryKey: ["price-list-active"] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => deletePriceRow(id),
    onSuccess: () => { toast.success("Rad borttagen"); qc.invalidateQueries({ queryKey: ["price-list-all"] }); qc.invalidateQueries({ queryKey: ["price-list-active"] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Fel"),
  });

  if (loading) return <AppShell title="Kalkyl"><Loader2 className="h-4 w-4 animate-spin" /></AppShell>;
  if (!isAdmin) return <AppShell title="Kalkyl"><p className="text-sm text-muted-foreground">Endast administratörer kan hantera prislistan.</p></AppShell>;

  const grouped = CATEGORIES.map((cat) => ({ cat, items: rows.filter((r) => r.category === cat) })).filter((g) => g.items.length > 0);

  return (
    <AppShell
      title="Kalkyl"
      description="Redigera enhetspriser som används i kalkyler, snabbpris och offerter."
    >
      <Tabs defaultValue="snabbpris" className="w-full">
        <TabsList>
          <TabsTrigger value="snabbpris">Snabbpris (takbyte & taktvätt)</TabsTrigger>
          <TabsTrigger value="detalj">Detaljprislista</TabsTrigger>
        </TabsList>

        <TabsContent value="snabbpris" className="mt-4">
          <QuickPriceAdmin />
        </TabsContent>

        <TabsContent value="detalj" className="mt-4 space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAdding(true)}><Plus className="mr-1 h-3.5 w-3.5" /> Ny rad</Button>
      </div>
      {adding && (
        <div className="mb-6 rounded-lg border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Ny prisrad</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div>
              <Label>Kategori</Label>
              <Select value={newRow.category} onValueChange={(v) => setNewRow({ ...newRow, category: v as PriceCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-2">
              <Label>Etikett</Label>
              <Input value={newRow.label} onChange={(e) => setNewRow({ ...newRow, label: e.target.value })} placeholder="t.ex. Betongpannor" />
            </div>
            <div>
              <Label>Nyckel</Label>
              <Input value={newRow.key} onChange={(e) => setNewRow({ ...newRow, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} placeholder="unik_nyckel" />
            </div>
            <div>
              <Label>Enhet</Label>
              <Select value={newRow.unit} onValueChange={(v) => setNewRow({ ...newRow, unit: v as PriceUnit })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pris</Label>
              <Input type="number" min={0} value={newRow.unit_price || ""} onChange={(e) => setNewRow({ ...newRow, unit_price: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => createM.mutate(newRow)} disabled={!newRow.key || !newRow.label || createM.isPending}>
              {createM.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Spara
            </Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>Avbryt</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <div className="space-y-6">
          {grouped.map(({ cat, items }) => (
            <section key={cat} className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-5 py-3">
                <h3 className="text-sm font-semibold">{CATEGORY_LABEL[cat]}</h3>
              </div>
              <div className="divide-y divide-border">
                {items.map((r) => (
                  <PriceRowEditor key={r.id} row={r} onSave={(patch) => updateM.mutate({ id: r.id, patch })} onDelete={() => { if (confirm(`Ta bort ${r.label}?`)) deleteM.mutate(r.id); }} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function PriceRowEditor({ row, onSave, onDelete }: { row: PriceRow; onSave: (patch: Partial<PriceRowInput>) => void; onDelete: () => void }) {
  const [label, setLabel] = useState(row.label);
  const [price, setPrice] = useState(row.unit_price);
  const [active, setActive] = useState(row.is_active);
  const dirty = label !== row.label || price !== row.unit_price || active !== row.is_active;

  return (
    <div className="grid grid-cols-[1fr_100px_80px_auto_auto] items-center gap-3 px-5 py-3">
      <div>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-8" />
        <div className="mt-1 text-[10px] font-mono text-muted-foreground">{row.key}</div>
      </div>
      <div className="flex items-center gap-1">
        <Input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} className="h-8" />
      </div>
      <Badge variant="outline">/ {row.unit}</Badge>
      <div className="flex items-center gap-2">
        <Switch checked={active} onCheckedChange={setActive} />
        <span className="text-xs text-muted-foreground">{active ? "Aktiv" : "Dold"}</span>
      </div>
      <div className="flex gap-1">
        {dirty && (
          <Button size="sm" onClick={() => onSave({ label, unit_price: price, is_active: active })}>Spara</Button>
        )}
        <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
