import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerPick {
  leadId: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  propertyDesignation: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (pick: CustomerPick) => void;
}

interface LeadRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  property: {
    address: string | null;
    municipality: string | null;
    property_designation: string | null;
  } | null;
}

export function SelectCustomerDialog({ open, onOpenChange, onSelect }: Props) {
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("leads")
      .select(
        "id, name, phone, email, property:properties(address, municipality, property_designation)",
      )
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (!error) setRows((data ?? []) as unknown as LeadRow[]);
        setLoading(false);
      });
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const parts = [
        r.name,
        r.phone ?? "",
        r.email ?? "",
        r.property?.address ?? "",
        r.property?.municipality ?? "",
        r.property?.property_designation ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return parts.includes(q);
    });
  }, [rows, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Välj kund</DialogTitle>
          <DialogDescription>
            Sök på namn, telefon, mail, adress eller fastighetsbeteckning.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            className="pl-9"
            placeholder="Sök kund…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-[420px] overflow-y-auto -mx-2 mt-2">
          {loading ? (
            <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Laddar kunder…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Inga träffar.</div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-muted"
                    onClick={() => {
                      onSelect({
                        leadId: r.id,
                        name: r.name ?? "",
                        phone: r.phone ?? "",
                        email: r.email ?? "",
                        address: [r.property?.address, r.property?.municipality]
                          .filter(Boolean)
                          .join(", "),
                        propertyDesignation: r.property?.property_designation ?? "",
                      });
                      onOpenChange(false);
                    }}
                  >
                    <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{r.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[r.property?.address, r.property?.municipality]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[r.phone, r.email, r.property?.property_designation]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
