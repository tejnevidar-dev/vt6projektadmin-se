import type { Lead } from "./types";

/**
 * Beräkna lead-score 0-100 baserat på fastighet och status.
 * Högre = bättre kandidat att kontakta först.
 */
export function calculateLeadScore(lead: Pick<Lead, "roofAge" | "buildYear" | "hasRoofPermit" | "jobType" | "status" | "roofType">): number {
  let score = 0;

  // Takålder är viktigast för takbyte
  if (lead.jobType === "roof_replacement") {
    if (lead.roofAge >= 50) score += 40;
    else if (lead.roofAge >= 40) score += 32;
    else if (lead.roofAge >= 30) score += 22;
    else if (lead.roofAge >= 20) score += 10;
  } else if (lead.jobType === "roof_cleaning") {
    if (lead.roofAge >= 10) score += 25;
    else if (lead.roofAge >= 5) score += 15;
  } else {
    score += 10;
  }

  // Bygglov är en stark signal
  if (lead.hasRoofPermit) score += 25;

  // Riskabla taktyper
  const rt = (lead.roofType || "").toLowerCase();
  if (rt.includes("eternit")) score += 20;
  else if (rt.includes("papp")) score += 12;
  else if (rt.includes("betong")) score += 6;

  // Status-bonus
  if (lead.status === "hot") score += 15;
  else if (lead.status === "warm") score += 8;
  else if (lead.status === "lost") score -= 30;

  // Mycket gamla hus
  if (lead.buildYear > 0 && lead.buildYear < 1970) score += 8;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function scoreLabel(score: number): { label: string; className: string } {
  if (score >= 70) return { label: "Het prio", className: "bg-destructive/15 text-destructive" };
  if (score >= 45) return { label: "Hög prio", className: "bg-warning/15 text-warning-foreground" };
  if (score >= 25) return { label: "Medel", className: "bg-info/15 text-info" };
  return { label: "Låg", className: "bg-muted text-muted-foreground" };
}
