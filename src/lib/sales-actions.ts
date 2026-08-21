import type { Lead } from "@/lib/types";
import { PIPELINE_STAGE_LABELS } from "@/lib/types";
import { netValue } from "@/lib/commission";
import { isLost, isOpen, isWon } from "@/lib/sales-command-center";

const DAY = 86400000;

const dateOf = (v: string | null | undefined) => (v ? new Date(v) : null);

export function daysSince(v: string | null | undefined, now = new Date()): number | null {
  const d = dateOf(v);
  if (!d) return null;
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / DAY));
}

/** Dagar sedan senaste kundkontakt (faller tillbaka på när leadet skapades). */
export function daysSinceContact(l: Lead, now = new Date()): number {
  return daysSince(l.lastContact, now) ?? daysSince(l.createdAt, now) ?? 0;
}

export type Priority = "hog" | "medel" | "lag";

export interface SalesAction {
  id: string;
  lead: Lead;
  priority: Priority;
  /** Kort rubrik, t.ex. "Ring Anders". */
  title: string;
  /** Motivering, t.ex. "Offert 184 000 kr – ingen uppföljning på 5 dagar". */
  reason: string;
  kind: "ring" | "boka" | "offert" | "mote" | "uppfoljning" | "komplettera";
  value: number;
  /** Sorteringsvikt – högre först. */
  weight: number;
}

export const PRIORITY_META: Record<Priority, { label: string; dot: string; className: string }> = {
  hog: { label: "Hög", dot: "bg-destructive", className: "bg-destructive/10 text-destructive border-destructive/30" },
  medel: { label: "Medel", dot: "bg-warning", className: "bg-warning/10 text-warning-foreground border-warning/30" },
  lag: { label: "Låg", dot: "bg-success", className: "bg-success/10 text-success border-success/30" },
};

/** Uppföljningsschema efter skickad offert (dagar). */
export const FOLLOW_UP_DAYS = [2, 5, 10, 20];

/** Nästa planerade uppföljning för en skickad offert – null när schemat är slut. */
export function nextFollowUp(daysSinceSent: number): { due: number; missed: boolean } | null {
  for (const d of FOLLOW_UP_DAYS) {
    if (daysSinceSent < d) return { due: d - daysSinceSent, missed: false };
  }
  return null;
}

/** Har en planerad uppföljning missats? */
export function missedFollowUp(daysSinceContactVal: number, stage: Lead["pipelineStage"]): boolean {
  if (stage === "offert_skickad" || stage === "uppfoljning" || stage === "forhandling") return daysSinceContactVal >= 3;
  if (stage === "mote_genomfort" || stage === "offererad") return daysSinceContactVal >= 2;
  if (stage === "saljpanel" || stage === "inkommande_webb" || stage === "kontaktad") return daysSinceContactVal >= 1;
  return false;
}

const kr0 = (n: number) => `${Math.round(n).toLocaleString("sv-SE")} kr`;

/** Dagens prioriterade att-göra-lista, sorterad efter angelägenhet × värde. */
export function todaysActions(leads: Lead[], now = new Date()): SalesAction[] {
  const out: SalesAction[] = [];
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + DAY);

  for (const l of leads) {
    const value = netValue(l);
    const contactAge = daysSinceContact(l, now);
    const stageLabel = PIPELINE_STAGE_LABELS[l.pipelineStage];

    // Dagens bokade möten / jobbstarter
    const booking = dateOf(l.bookingDate);
    if (booking && booking >= startOfDay && booking < endOfDay) {
      out.push({
        id: `${l.id}-mote`,
        lead: l,
        priority: "lag",
        kind: "mote",
        title: `Kundmöte ${booking.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })} – ${l.name}`,
        reason: `${stageLabel}${value > 0 ? ` · ${kr0(value)}` : ""}`,
        value,
        weight: 5_000_000,
      });
    }

    if (!isOpen(l)) continue;

    // Offert väntar på att skickas
    if (l.needsOffer || l.pipelineStage === "offererad") {
      out.push({
        id: `${l.id}-offert`,
        lead: l,
        priority: contactAge >= 2 ? "hog" : "medel",
        kind: "offert",
        title: `Skicka offert till ${l.name}`,
        reason: `${stageLabel} · ${contactAge} dagar sedan senaste kontakt`,
        value,
        weight: value + contactAge * 12000 + 60000,
      });
      continue;
    }

    // Skickad offert / förhandling utan uppföljning
    if (l.pipelineStage === "offert_skickad" || l.pipelineStage === "uppfoljning" || l.pipelineStage === "forhandling") {
      const missed = missedFollowUp(contactAge, l.pipelineStage);
      out.push({
        id: `${l.id}-uppfoljning`,
        lead: l,
        priority: missed ? "hog" : "medel",
        kind: "ring",
        title: `Ring ${l.name}`,
        reason: value > 0
          ? `Offert ${kr0(value)} – ${missed ? `ingen uppföljning på ${contactAge} dagar` : `uppföljning i ${stageLabel.toLowerCase()}`}`
          : `${stageLabel} – ${contactAge} dagar sedan kontakt`,
        value,
        weight: value + contactAge * 15000 + (missed ? 80000 : 0),
      });
      continue;
    }

    // Nytt lead som ska kontaktas / möte bokas
    if (l.pipelineStage === "saljpanel" || l.pipelineStage === "inkommande_webb" || l.pipelineStage === "kontaktad") {
      const isNew = (daysSince(l.createdAt, now) ?? 0) <= 1;
      out.push({
        id: `${l.id}-boka`,
        lead: l,
        priority: contactAge >= 3 ? "hog" : "medel",
        kind: "boka",
        title: `${l.pipelineStage === "kontaktad" ? "Boka möte med" : "Ring nytt lead"} ${l.name}`,
        reason: isNew
          ? `Nytt lead sedan ${contactAge === 0 ? "idag" : "igår"} · score ${l.score}`
          : `${stageLabel} · ${contactAge} dagar utan kontakt · score ${l.score}`,
        value,
        weight: l.score * 2000 + contactAge * 9000 + (isNew ? 50000 : 0),
      });
      continue;
    }

    // Möte genomfört – dags att offerera
    if (l.pipelineStage === "mote_bokat" || l.pipelineStage === "mote_genomfort") {
      out.push({
        id: `${l.id}-followup`,
        lead: l,
        priority: contactAge >= 3 ? "hog" : "medel",
        kind: "uppfoljning",
        title: `Följ upp ${l.name}`,
        reason: `${stageLabel} · ${contactAge} dagar sedan kontakt`,
        value,
        weight: value * 0.8 + contactAge * 10000,
      });
    }
  }

  const order: Record<Priority, number> = { hog: 0, medel: 1, lag: 2 };
  return out.sort((a, b) => order[a.priority] - order[b.priority] || b.weight - a.weight);
}

export interface StaleDeal {
  lead: Lead;
  /** Riskpoäng 0–100, högre = större risk att affären dör. */
  risk: number;
  daysSinceContact: number;
  daysInPipeline: number;
  value: number;
  reasons: string[];
}

/** Affärer som riskerar att dö – ingen kontakt, länge i samma steg, högt värde. */
export function staleDeals(leads: Lead[], now = new Date(), minRisk = 40): StaleDeal[] {
  const rows: StaleDeal[] = [];
  for (const l of leads) {
    if (!isOpen(l)) continue;
    const contactAge = daysSinceContact(l, now);
    const age = daysSince(l.createdAt, now) ?? 0;
    const value = netValue(l);
    if (contactAge < 4 && age < 21) continue;

    const reasons: string[] = [];
    let risk = 0;

    if (contactAge >= 21) { risk += 45; reasons.push(`Ingen kundkontakt på ${contactAge} dagar`); }
    else if (contactAge >= 14) { risk += 35; reasons.push(`Ingen kundkontakt på ${contactAge} dagar`); }
    else if (contactAge >= 7) { risk += 25; reasons.push(`Ingen kundkontakt på ${contactAge} dagar`); }
    else if (contactAge >= 4) { risk += 15; reasons.push(`${contactAge} dagar sedan senaste kontakt`); }

    if (age >= 60) { risk += 25; reasons.push(`${age} dagar i pipelinen`); }
    else if (age >= 30) { risk += 15; reasons.push(`${age} dagar i pipelinen`); }

    if (value >= 250000) { risk += 12; reasons.push("Högt affärsvärde – prioritera"); }
    else if (value > 0) risk += 6;

    if (l.pipelineStage === "offert_skickad" || l.pipelineStage === "uppfoljning" || l.pipelineStage === "forhandling") {
      risk += 15;
      reasons.push("Offert ute utan avslut");
    }
    if (l.status === "cold") { risk += 8; reasons.push("Kall status"); }

    risk = Math.max(0, Math.min(100, Math.round(risk)));
    if (risk >= minRisk) {
      rows.push({ lead: l, risk, daysSinceContact: contactAge, daysInPipeline: age, value, reasons });
    }
  }
  return rows.sort((a, b) => b.risk - a.risk || b.value - a.value);
}

export interface ActionSummary {
  total: number;
  high: number;
  meetingsToday: number;
  offersToSend: number;
  pipelineAtRisk: number;
}

export function actionSummary(actions: SalesAction[], stale: StaleDeal[]): ActionSummary {
  return {
    total: actions.length,
    high: actions.filter((a) => a.priority === "hog").length,
    meetingsToday: actions.filter((a) => a.kind === "mote").length,
    offersToSend: actions.filter((a) => a.kind === "offert").length,
    pipelineAtRisk: Math.round(stale.reduce((s, d) => s + d.value, 0)),
  };
}

export { isOpen, isWon, isLost };
