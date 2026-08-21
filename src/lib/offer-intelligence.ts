import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "@/lib/types";
import { netValue } from "@/lib/commission";

export interface OfferRow {
  id: string;
  leadId: string | null;
  version: number;
  status: string;
  totalAmount: number;
  sentAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
}

/** Hämtar alla offerter (RLS styr vad användaren får se). */
export async function fetchOffers(): Promise<OfferRow[]> {
  const { data, error } = await supabase
    .from("offers")
    .select("id, lead_id, version, status, total_amount, sent_at, accepted_at, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((o) => ({
    id: o.id,
    leadId: o.lead_id,
    version: o.version,
    status: o.status,
    totalAmount: Number(o.total_amount ?? 0),
    sentAt: o.sent_at,
    acceptedAt: o.accepted_at,
    createdAt: o.created_at,
  }));
}

const days = (a: string | null, b: string | null) =>
  a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 86400000 : null;

export interface OfferIntel {
  total: number;
  sent: number;
  accepted: number;
  rejected: number;
  open: number;
  winRate: number;
  avgAmount: number;
  avgAcceptedAmount: number;
  avgRejectedAmount: number;
  /** Snitt dagar från skickad → accepterad. */
  avgResponseDays: number | null;
  /** Snitt antal versioner per kund/affär. */
  avgVersions: number;
  /** Andel affärer som krävde mer än en version. */
  revisedShare: number;
  /** Offerter som skickats men inte fått svar på länge. */
  stale: { offer: OfferRow; days: number }[];
}

export function offerIntel(offers: OfferRow[], now = new Date()): OfferIntel {
  const sent = offers.filter((o) => o.sentAt);
  const accepted = offers.filter((o) => o.status === "accepterad");
  const rejected = offers.filter((o) => o.status === "avvisad");
  const decided = accepted.length + rejected.length;

  const responses = accepted
    .map((o) => days(o.sentAt, o.acceptedAt))
    .filter((n): n is number => n != null && n >= 0);

  const perLead = new Map<string, number>();
  for (const o of offers) {
    if (!o.leadId) continue;
    perLead.set(o.leadId, Math.max(perLead.get(o.leadId) ?? 0, o.version));
  }
  const versions = [...perLead.values()];

  const avg = (rows: OfferRow[]) =>
    rows.length ? Math.round(rows.reduce((s, o) => s + o.totalAmount, 0) / rows.length) : 0;

  const stale = sent
    .filter((o) => o.status === "skickad")
    .map((o) => ({ offer: o, days: Math.floor((now.getTime() - new Date(o.sentAt!).getTime()) / 86400000) }))
    .filter((r) => r.days >= 5)
    .sort((a, b) => b.days - a.days);

  return {
    total: offers.length,
    sent: sent.length,
    accepted: accepted.length,
    rejected: rejected.length,
    open: offers.filter((o) => o.status === "skickad").length,
    winRate: decided ? (accepted.length / decided) * 100 : 0,
    avgAmount: avg(offers),
    avgAcceptedAmount: avg(accepted),
    avgRejectedAmount: avg(rejected),
    avgResponseDays: responses.length
      ? Math.round((responses.reduce((a, b) => a + b, 0) / responses.length) * 10) / 10
      : null,
    avgVersions: versions.length
      ? Math.round((versions.reduce((a, b) => a + b, 0) / versions.length) * 100) / 100
      : 0,
    revisedShare: versions.length ? (versions.filter((v) => v > 1).length / versions.length) * 100 : 0,
    stale: stale.slice(0, 15),
  };
}

export interface PriceBucket {
  label: string;
  min: number;
  max: number;
  count: number;
  won: number;
  winRate: number;
}

const BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "< 100 tkr", min: 0, max: 100_000 },
  { label: "100–200 tkr", min: 100_000, max: 200_000 },
  { label: "200–300 tkr", min: 200_000, max: 300_000 },
  { label: "300–500 tkr", min: 300_000, max: 500_000 },
  { label: "> 500 tkr", min: 500_000, max: Infinity },
];

/** Vinstgrad per prisnivå – vilka prisklasser vinner vi? */
export function priceBuckets(offers: OfferRow[]): PriceBucket[] {
  return BUCKETS.map((b) => {
    const rows = offers.filter(
      (o) => (o.status === "accepterad" || o.status === "avvisad") && o.totalAmount >= b.min && o.totalAmount < b.max,
    );
    const won = rows.filter((o) => o.status === "accepterad").length;
    return { ...b, count: rows.length, won, winRate: rows.length ? (won / rows.length) * 100 : 0 };
  });
}

/** Fallback när offertdata saknas: räkna på leads i offertsteg. */
export function leadOfferFallback(leads: Lead[]) {
  const offered = leads.filter((l) =>
    ["offererad", "offert_skickad", "uppfoljning", "forhandling"].includes(l.pipelineStage),
  );
  return {
    count: offered.length,
    value: Math.round(offered.reduce((s, l) => s + netValue(l), 0)),
  };
}
