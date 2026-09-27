import { describe, expect, it } from "vitest";
import { buildMorningStats, computeUnpaidToUe, monthStartStockholm, type StatsInvoice, type StatsLead, type StatsWorkOrder } from "@/lib/morning-stats";

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
        lead({ id: "e", created_at: hoursAgo(609) }), // gammal (609 h) obesvarad: ska OCKSÅ räknas som over_sla
        lead({ id: "f", created_at: hoursAgo(6), source: "field" }), // ej intagskälla
      ],
      staffTouchedLeadIds: new Set(["c"]),
      slaHours: 2,
      intakeErrors24h: 0,
      now,
    });
    // Bugg t.o.m. 2026-09-27: en 72-timmarsgräns gjorde att leads äldre än det aldrig
    // räknades som over_sla, trots att de var långt över SLA-tiden (609 h i detta fall).
    expect(s.unanswered.over_sla).toBe(2);
    expect(s.unanswered.total).toBe(3);
    expect(s.unanswered.oldest_hours).toBe(609);
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

  it("kapacitet: sålda men ej utförda takbyten, aktiva UE per yrke", () => {
    const s = buildMorningStats({
      leads: [
        lead({ id: "r1", pipeline_stage: "bokad", job_type: "roof_replacement" }),
        lead({ id: "r2", pipeline_stage: "pagaende", job_type: "roof_replacement" }),
        lead({ id: "r3", pipeline_stage: "slutford", job_type: "roof_replacement" }), // klar, räknas inte
        lead({ id: "r4", pipeline_stage: "bokad", job_type: "roof_cleaning" }), // fel jobbtyp
        lead({ id: "r5", pipeline_stage: "offert_skickad", job_type: "roof_replacement" }), // inte sålt än
      ],
      subcontractors: [
        { trade: "taklaggare", pipeline_status: "aktiv", active: true },
        { trade: "taklaggare", pipeline_status: "aktiv", active: true },
        { trade: "platslagare", pipeline_status: "aktiv", active: true },
        { trade: "bada", pipeline_status: "aktiv", active: true },
        { trade: "taklaggare", pipeline_status: "provjobb", active: true }, // inte aktiv än
        { trade: "taklaggare", pipeline_status: "aktiv", active: false }, // inaktiv
        { trade: null, pipeline_status: "aktiv", active: true },
      ],
      staffTouchedLeadIds: new Set(),
      slaHours: 2,
      intakeErrors24h: 0,
      now,
    });
    expect(s.capacity.sold_not_executed_roof_replacements).toBe(2);
    expect(s.capacity.active_ue).toEqual({ taklaggare: 2, platslagare: 1, bada: 1, total: 5 });
  });
});

describe("computeUnpaidToUe", () => {
  const wo = (o: Partial<StatsWorkOrder> & { id: string }): StatsWorkOrder => ({
    job_id: null,
    status: "accepted",
    ue_price: 50000,
    ...o,
  });
  const inv = (o: Partial<StatsInvoice>): StatsInvoice => ({
    job_id: null,
    work_order_id: null,
    amount: 10000,
    vat_amount: null,
    status: "mottagen",
    ...o,
  });

  it("räknar mottagna och godkända fakturor, inte betalda eller avvisade", () => {
    const total = computeUnpaidToUe(
      [],
      [inv({ status: "mottagen", amount: 10000 }), inv({ status: "godkand", amount: 20000 }), inv({ status: "betald", amount: 99999 }), inv({ status: "avvisad", amount: 99999 })],
    );
    expect(total).toBe(30000);
  });
  it("lägger till momsen på fakturan om den finns", () => {
    expect(computeUnpaidToUe([], [inv({ amount: 10000, vat_amount: 2500 })])).toBe(12500);
  });
  it("accepterad arbetsorder utan faktura räknas via ue_price", () => {
    expect(computeUnpaidToUe([wo({ id: "w1", ue_price: 45000 })], [])).toBe(45000);
  });
  it("dubbelräknar inte en arbetsorder som redan har en aktiv faktura", () => {
    const total = computeUnpaidToUe(
      [wo({ id: "w1", ue_price: 45000 })],
      [inv({ work_order_id: "w1", status: "godkand", amount: 40000 })],
    );
    expect(total).toBe(40000);
  });
  it("en avvisad faktura konsumerar inte fallbacken - ue_price räknas ändå", () => {
    const total = computeUnpaidToUe(
      [wo({ id: "w1", job_id: "j1", ue_price: 45000 })],
      [inv({ job_id: "j1", work_order_id: "w1", status: "avvisad", amount: 45000 })],
    );
    expect(total).toBe(45000);
  });
  it("faller tillbaka på job_id-matchning när faktura saknar work_order_id (äldre fakturor)", () => {
    const total = computeUnpaidToUe(
      [wo({ id: "w1", job_id: "j1", ue_price: 45000 })],
      [inv({ job_id: "j1", work_order_id: null, status: "godkand", amount: 42000 })],
    );
    expect(total).toBe(42000);
  });
  it("ignorerar arbetsordrar som inte är accepterade eller saknar pris", () => {
    expect(computeUnpaidToUe([wo({ id: "w1", status: "offered" }), wo({ id: "w2", ue_price: null })], [])).toBe(0);
  });
});
