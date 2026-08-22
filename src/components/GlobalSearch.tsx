import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { PIPELINE_STAGE_LABELS } from "@/lib/types";
import type { PipelineStage } from "@/lib/types";
import { Users, Hammer, ArrowRight } from "lucide-react";

export interface QuickNavItem {
  to: string;
  label: string;
  group: string;
}

interface LeadHit {
  id: string;
  name: string;
  phone: string | null;
  stage: PipelineStage;
  address: string | null;
}

interface JobHit {
  id: string;
  customer_name: string | null;
  address: string | null;
  status: string;
}

export function GlobalSearch({
  open,
  onOpenChange,
  navItems,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  navItems: QuickNavItem[];
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<LeadHit[]>([]);
  const [jobs, setJobs] = useState<JobHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setLeads([]);
      setJobs([]);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setLeads([]);
      setJobs([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const like = `%${q}%`;
      const [leadRes, jobRes, propRes] = await Promise.all([
        supabase
          .from("leads")
          .select("id, name, phone, pipeline_stage, property:properties(address)")
          .or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like},personal_number.ilike.${like}`)
          .limit(8),
        supabase
          .from("jobs")
          .select("id, customer_name, address, status")
          .or(`customer_name.ilike.${like},address.ilike.${like},client_company.ilike.${like}`)
          .limit(6),
        supabase
          .from("leads")
          .select("id, name, phone, pipeline_stage, property:properties!inner(address)")
          .ilike("properties.address", like)
          .limit(6),
      ]);
      if (cancelled) return;
      const map = new Map<string, LeadHit>();
      for (const row of [...((leadRes.data as any[]) ?? []), ...((propRes.data as any[]) ?? [])]) {
        map.set(row.id, {
          id: row.id,
          name: row.name,
          phone: row.phone ?? null,
          stage: row.pipeline_stage,
          address: row.property?.address ?? null,
        });
      }
      setLeads(Array.from(map.values()).slice(0, 10));
      setJobs(((jobRes.data as any[]) ?? []) as JobHit[]);
      setLoading(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navItems.slice(0, 8);
    return navItems.filter((n) => n.label.toLowerCase().includes(q)).slice(0, 6);
  }, [navItems, query]);

  const go = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Sök kund, adress, telefon, personnummer eller sida…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{loading ? "Söker…" : "Inga träffar."}</CommandEmpty>

        {leads.length > 0 && (
          <CommandGroup heading="Kunder / leads">
            {leads.map((l) => (
              <CommandItem
                key={l.id}
                value={`lead-${l.id}-${l.name}-${l.address ?? ""}`}
                onSelect={() => go(() => navigate({ to: "/leads", search: { lead: l.id } as never }))}
              >
                <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{l.name}</span>
                <span className="ml-2 truncate text-xs text-muted-foreground">
                  {[l.address, l.phone].filter(Boolean).join(" · ")}
                </span>
                <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {PIPELINE_STAGE_LABELS[l.stage] ?? ""}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {jobs.length > 0 && (
          <CommandGroup heading="Projekt">
            {jobs.map((j) => (
              <CommandItem
                key={j.id}
                value={`job-${j.id}-${j.customer_name ?? ""}`}
                onSelect={() => go(() => navigate({ to: "/jobb/$jobId", params: { jobId: j.id } }))}
              >
                <Hammer className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{j.customer_name ?? "Projekt"}</span>
                <span className="ml-2 truncate text-xs text-muted-foreground">{j.address ?? ""}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {(leads.length > 0 || jobs.length > 0) && filteredNav.length > 0 && <CommandSeparator />}

        {filteredNav.length > 0 && (
          <CommandGroup heading="Gå till">
            {filteredNav.map((n) => (
              <CommandItem
                key={n.to + n.label}
                value={`nav-${n.label}`}
                onSelect={() => go(() => navigate({ to: n.to }))}
              >
                <ArrowRight className="mr-2 h-4 w-4 text-muted-foreground" />
                {n.label}
                <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">{n.group}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/** Registrerar ⌘K / Ctrl+K. */
export function useCommandK(setOpen: (fn: (v: boolean) => boolean) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setOpen]);
}
