import { describe, expect, it } from "vitest";
import { buildMorningStats, monthStartStockholm, type StatsLead } from "@/lib/morning-stats";

const now = new Date("2026-09-26T08:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();

const lead = (o: Partial<StatsLead> & { id: string }): StatsLead => ({
  source: "roslagstak",
  pipeline_stage: "inkommande_webb",
  created_at: hoursAgo(1),
  updated_at: hoursAgo(1),
  offer_accepted_at: null,
  completed_at: null,
  last_contact: null,
  ...o,
});

describe("buildMorningStats", () => {
  it("räknar nya leads per fönster och källa", () => {
    const s = buildMorningStats({
      leads: [
        lead({ id: "1", created_at: hoursAgo(2) }),
        lead({ id: "2", source: "email", created_at: hoursAgo(30) }),
        lead({ id: "3", source: "inbox", created_at: hoursAgo(24 * 20) }),
      ],
      staffTouchedLeadIds: new Set(),
      slaHours: 2,
      intakeErrors24h: 0,
      now,
    });
    expect(s.new_leads.last_24h).toEqual({ total: 1, by_source: { roslagstak: 1 } });
    expect(s.new_leads.last_7d.total).toBe(2);
    expect(s.new_leads.month_to_date.total).toBe(3); // lead 3 skapades 6 sep, samma månad
  });

  it("obesvarade: SLA-regel, personal-aktivitet och kontakt räknas bort", () => {
    const s = buildMorningStats({
      leads: [
        lead({ id: "a", created_at: hoursAgo(5) }), // obesvarad över SLA
        lead({ id: "b", created_at: hoursAgo(1) }), // obesvarad men under SLA
        lead({ id: "c", created_at: hoursAgo(6) }), // hanterad av personal
        lead({ id: "d", created_at: hoursAgo(6), last_contact: hoursAgo(3) }), // kontaktad
        lead({ id: "e", created_at: hoursAgo(100) }), // äldre än 72 h: bara i total
        lead({ id: "f", created_at: hoursAgo(6), source: "field" }), // ej intagskälla
      ],
      staffTouchedLeadIds: new Set(["c"]),
      slaHours: 2,
      intakeErrors24h: 0,
      now,
    });
    expect(s.unanswered.over_sla).toBe(1);
    expect(s.unanswered.total).toBe(3);
    expect(s.unanswered.oldest_hours).toBe(100);
  });

  it("vunna jobb och offerter ute", () => {
    const s = buildMorningStats({
      leads: [
        lead({ id: "w1", pipeline_stage: "bokad", updated_at: hoursAgo(3) }),
        lead({ id: "w2", pipeline_stage: "offert_skickad", offer_accepted_at: hoursAgo(50), created_at: hoursAgo(300) }),
        lead({ id: "o1", pipeline_stage: "offert_skickad", created_at: hoursAgo(300) }),
      ],
      staffTouchedLeadIds: new Set(),
      slaHours: 2,
      intakeErrors24h: 2,
      now,
    });
    expect(s.offers_out).toBe(2);
    expect(s.won.total).toBe(2);
    expect(s.won.last_24h.total).toBe(1);
    expect(s.won.last_7d.total).toBe(2);
    expect(s.intake_errors_24h).toBe(2);
  });

  it("betalda jobb och betalt belopp per period", () => {
    const s = buildMorningStats({
      leads: [
        lead({ id: "p1", customer_paid_at: hoursAgo(24), customer_paid_amount: 100000 }),
        lead({ id: "p2", customer_paid_at: hoursAgo(24 * 20), customer_paid_amount: "50000.50" }),
        lead({ id: "p3", customer_paid_at: hoursAgo(24 * 60), customer_paid_amount: 10000 }),
        lead({ id: "u1" }),
      ],
      staffTouchedLeadIds: new Set(),
      slaHours: 2,
      intakeErrors24h: 0,
      now,
    });
    expect(s.paid.last_7d).toEqual({ jobs: 1, amount: 100000 });
    expect(s.paid.month_to_date).toEqual({ jobs: 2, amount: 150000.5 });
    expect(s.paid.total).toEqual({ jobs: 3, amount: 160000.5 });
  });

  it("innehåller inga personuppgifter", () => {
    const json = JSON.stringify(
      buildMorningStats({ leads: [lead({ id: "secret-id-123" })], staffTouchedLeadIds: new Set(), slaHours: 2, intakeErrors24h: 0, now }),
    );
    expect(json).not.toContain("secret-id-123");
  });

  it("tomt läge ger nollor och null", () => {
    const s = buildMorningStats({ leads: [], staffTouchedLeadIds: new Set(), slaHours: 2, intakeErrors24h: 0, now });
    expect(s.last_lead_at).toBeNull();
    expect(s.unanswered.oldest_hours).toBeNull();
    expect(s.new_leads.last_24h.total).toBe(0);
  });

  it("månadsstart i Stockholmstid", () => {
    expect(monthStartStockholm(now).toISOString()).toBe("2026-08-31T22:00:00.000Z");
  });
});
