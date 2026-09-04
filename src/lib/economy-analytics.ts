import type { Lead } from "@/lib/types";
import { isRotApplicationDue } from "@/lib/types";

export const VAT = 0.25;

/** Ordervärde exkl. moms. */
export const net = (l: Lead) => (l.price ?? 0) / (1 + VAT);
/** Täckningsbidrag = netto − materialkostnad (− ev. UE-pris). */
export const margin = (l: Lead) => net(l) - (l.materialCost ?? 0) - (l.subcontractorPrice ?? 0);

const day = 86400000;

export const dueDate = (l: Lead): Date | null =>
  l.invoiceDueDate ? new Date(`${l.invoiceDueDate}T00:00:00`) : null;

/** Dagar kvar till förfallodatum (negativt = försenad). */
export function daysToDue(l: Lead, now = new Date()): number | null {
  const d = dueDate(l);
  if (!d) return null;
  return Math.round((d.getTime() - now.getTime()) / day);
}

/** Slutförda jobb = ekonomins arbetsunderlag. */
export const completedLeads = (leads: Lead[]) => leads.filter((l) => l.pipelineStage === "slutford");

export const isOverdue = (l: Lead, now = new Date()) => {
  if (!l.invoiced) return false;
  const d = daysToDue(l, now);
  return d != null && d < 0;
};

export const rotOutstanding = (l: Lead) =>
  l.rotEligible && (l.rotAmount ?? 0) > 0 && !l.rotPaid;

/** Saknade uppgifter som blockerar ROT-ansökan. */
export function missingRotData(l: Lead): string[] {
  const missing: string[] = [];
  if (!l.rotEligible) return missing;
  if (!l.personalNumber) missing.push("Personnummer");
  if (!l.propertyDesignation) missing.push("Fastighetsbeteckning");
  if ((l.rotAmount ?? 0) <= 0) missing.push("ROT-belopp");
  if (l.price == null) missing.push("Pris");
  return missing;
}

export interface EconomyKpis {
  jobs: number;
  revenueGross: number;
  revenueNet: number;
  materialCost: number;
  margin: number;
  marginPct: number;
  invoicedAmount: number;
  uninvoicedAmount: number;
  uninvoicedCount: number;
  overdueAmount: number;
  overdueCount: number;
  dueSoonCount: number;
  rotOutstandingAmount: number;
  rotOutstandingCount: number;
  rotDueCount: number;
  rotAppliedAmount: number;
  missingDataCount: number;
}

export function economyKpis(leads: Lead[], now = new Date()): EconomyKpis {
  const rows = completedLeads(leads);
  const revenueGross = rows.reduce((s, l) => s + (l.price ?? 0), 0);
  const revenueNet = rows.reduce((s, l) => s + net(l), 0);
  const materialCost = rows.reduce((s, l) => s + (l.materialCost ?? 0) + (l.subcontractorPrice ?? 0), 0);
  const marginSum = revenueNet - materialCost;
  const uninvoiced = rows.filter((l) => !l.invoiced);
  const overdue = rows.filter((l) => isOverdue(l, now));
  const dueSoon = rows.filter((l) => {
    const d = daysToDue(l, now);
    return l.invoiced && d != null && d >= 0 && d <= 7;
  });
  const rotOut = rows.filter(rotOutstanding);

  return {
    jobs: rows.length,
    revenueGross: Math.round(revenueGross),
    revenueNet: Math.round(revenueNet),
    materialCost: Math.round(materialCost),
    margin: Math.round(marginSum),
    marginPct: revenueNet ? (marginSum / revenueNet) * 100 : 0,
    invoicedAmount: Math.round(rows.filter((l) => l.invoiced).reduce((s, l) => s + (l.price ?? 0), 0)),
    uninvoicedAmount: Math.round(uninvoiced.reduce((s, l) => s + (l.price ?? 0), 0)),
    uninvoicedCount: uninvoiced.length,
    overdueAmount: Math.round(overdue.reduce((s, l) => s + (l.price ?? 0), 0)),
    overdueCount: overdue.length,
    dueSoonCount: dueSoon.length,
    rotOutstandingAmount: Math.round(rotOut.reduce((s, l) => s + (l.rotAmount ?? 0), 0)),
    rotOutstandingCount: rotOut.length,
    rotDueCount: rows.filter((l) => isRotApplicationDue(l, now)).length,
    rotAppliedAmount: Math.round(
      rows.filter((l) => l.rotPaid).reduce((s, l) => s + (l.rotAmount ?? 0), 0),
    ),
    missingDataCount: rows.filter((l) => missingRotData(l).length > 0).length,
  };
}

export interface MonthPoint {
  month: string;
  revenueNet: number;
  material: number;
  margin: number;
  rot: number;
  jobs: number;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Datum som styr vilken månad affären bokförs på. */
export const economyDate = (l: Lead): Date | null => {
  const raw = l.invoicedAt ?? l.completedAt ?? l.offerAcceptedAt ?? l.createdAt ?? null;
  return raw ? new Date(raw) : null;
};

export function monthlySeries(leads: Lead[], months = 12, now = new Date()): MonthPoint[] {
  const rows = completedLeads(leads);
  const out: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    const inMonth = rows.filter((l) => {
      const ed = economyDate(l);
      return !!ed && monthKey(ed) === key;
    });
    const revenueNet = inMonth.reduce((s, l) => s + net(l), 0);
    const material = inMonth.reduce((s, l) => s + (l.materialCost ?? 0) + (l.subcontractorPrice ?? 0), 0);
    out.push({
      month: key,
      revenueNet: Math.round(revenueNet),
      material: Math.round(material),
      margin: Math.round(revenueNet - material),
      rot: Math.round(inMonth.reduce((s, l) => s + (l.rotAmount ?? 0), 0)),
      jobs: inMonth.length,
    });
  }
  return out;
}

export interface AgingBucket {
  label: string;
  count: number;
  amount: number;
  leads: Lead[];
}

/** Åldersfördelning på obetalda/ej fakturerade jobb. */
export function agingBuckets(leads: Lead[], now = new Date()): AgingBucket[] {
  const rows = completedLeads(leads).filter((l) => !l.rotPaid || !l.invoiced);
  const defs: { label: string; test: (d: number | null, l: Lead) => boolean }[] = [
    { label: "Ej fakturerad", test: (_d, l) => !l.invoiced },
    { label: "Inte förfallen", test: (d, l) => l.invoiced && d != null && d >= 0 },
    { label: "1–30 dagar sen", test: (d, l) => l.invoiced && d != null && d < 0 && d >= -30 },
    { label: "31–60 dagar sen", test: (d, l) => l.invoiced && d != null && d < -30 && d >= -60 },
    { label: "60+ dagar sen", test: (d, l) => l.invoiced && d != null && d < -60 },
  ];
  return defs.map((def) => {
    const bucket = rows.filter((l) => def.test(daysToDue(l, now), l));
    return {
      label: def.label,
      count: bucket.length,
      amount: Math.round(bucket.reduce((s, l) => s + (l.price ?? 0), 0)),
      leads: bucket.sort((a, b) => (daysToDue(a) ?? 0) - (daysToDue(b) ?? 0)),
    };
  });
}

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** Bokföringsunderlag som CSV (semikolon, UTF-8 BOM för Excel). */
export function economyCsv(leads: Lead[]): string {
  const header = [
    "Kund",
    "Personnummer",
    "Fastighetsbeteckning",
    "Adress",
    "Slutfört",
    "Pris inkl moms",
    "Netto",
    "Moms",
    "Materialkostnad",
    "TB",
    "ROT-belopp",
    "Fakturerad",
    "Fakturadatum",
    "Förfallodatum",
    "ROT ansökt",
    "Kommentar",
  ];
  const rows = completedLeads(leads).map((l) => [
    l.name,
    l.personalNumber ?? "",
    l.propertyDesignation ?? "",
    l.address ?? "",
    l.completedAt ? new Date(l.completedAt).toLocaleDateString("sv-SE") : "",
    Math.round(l.price ?? 0),
    Math.round(net(l)),
    Math.round((l.price ?? 0) - net(l)),
    Math.round(l.materialCost ?? 0),
    Math.round(margin(l)),
    Math.round(l.rotAmount ?? 0),
    l.invoiced ? "Ja" : "Nej",
    l.invoicedAt ? new Date(l.invoicedAt).toLocaleDateString("sv-SE") : "",
    l.invoiceDueDate ?? "",
    l.rotPaid ? "Ja" : "Nej",
    (l.economyNote ?? "").replace(/\n/g, " "),
  ]);
  return "\uFEFF" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\n");
}
