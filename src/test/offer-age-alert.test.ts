import { describe, expect, it } from "vitest";
import { findStaleOffers, type OfferLeadInfo, type StaleOfferInput } from "@/lib/offer-age-alert";

const now = new Date("2026-09-27T08:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

const offer = (o: Partial<StaleOfferInput> & { id: string; lead_id: string }): StaleOfferInput => ({
  status: "skickad",
  sent_at: daysAgo(8),
  ...o,
});

describe("findStaleOffers", () => {
  it("larmar på skickade offerter äldre än alertDays med känd säljare", () => {
    const leadInfo = new Map<string, OfferLeadInfo>([["l1", { seller_id: "s1", name: "Anna Andersson" }]]);
    const out = findStaleOffers([offer({ id: "o1", lead_id: "l1" })], leadInfo, 7, now);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ offerId: "o1", leadId: "l1", sellerId: "s1", leadName: "Anna Andersson", daysWaiting: 8 });
  });
  it("hoppar över offerter yngre än alertDays", () => {
    const leadInfo = new Map<string, OfferLeadInfo>([["l1", { seller_id: "s1", name: "X" }]]);
    expect(findStaleOffers([offer({ id: "o1", lead_id: "l1", sent_at: daysAgo(3) })], leadInfo, 7, now)).toHaveLength(0);
  });
  it("hoppar över andra statusar än 'skickad' (accepterad/avvisad/draft)", () => {
    const leadInfo = new Map<string, OfferLeadInfo>([["l1", { seller_id: "s1", name: "X" }]]);
    for (const status of ["accepterad", "avvisad", "draft"]) {
      expect(findStaleOffers([offer({ id: "o1", lead_id: "l1", status })], leadInfo, 7, now)).toHaveLength(0);
    }
  });
  it("hoppar över offerter utan sent_at", () => {
    const leadInfo = new Map<string, OfferLeadInfo>([["l1", { seller_id: "s1", name: "X" }]]);
    expect(findStaleOffers([offer({ id: "o1", lead_id: "l1", sent_at: null })], leadInfo, 7, now)).toHaveLength(0);
  });
  it("hoppar över leads utan känd säljare (ingen att notifiera)", () => {
    const leadInfo = new Map<string, OfferLeadInfo>([["l1", { seller_id: null, name: "X" }]]);
    expect(findStaleOffers([offer({ id: "o1", lead_id: "l1" })], leadInfo, 7, now)).toHaveLength(0);
  });
  it("hoppar över offerter vars lead saknas helt i leadInfo", () => {
    expect(findStaleOffers([offer({ id: "o1", lead_id: "unknown" })], new Map(), 7, now)).toHaveLength(0);
  });
  it("gränsfall: exakt alertDays gammal räknas som gammal nog", () => {
    const leadInfo = new Map<string, OfferLeadInfo>([["l1", { seller_id: "s1", name: "X" }]]);
    expect(findStaleOffers([offer({ id: "o1", lead_id: "l1", sent_at: daysAgo(7) })], leadInfo, 7, now)).toHaveLength(1);
  });
});
