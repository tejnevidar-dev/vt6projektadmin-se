import { describe, expect, it } from "vitest";
import { buildWorkOrderContent, offerExpiry, pickNextSubcontractor, upcomingExpiries } from "@/lib/work-order";

const prices = [
  { key: "betong", label: "Betongpannor", unit: "kvm" },
  { key: "snoskydd", label: "Snörasskydd", unit: "meter" },
];

describe("buildWorkOrderContent", () => {
  const c = buildWorkOrderContent({
    offerNumber: "2026-001",
    address: "Storgatan 1",
    calc: {
      roof_area_kvm: "120",
      ranndalar_meter: 30,
      material_key: "betong",
      plat_items: [
        { key: "snoskydd", quantity: 12 },
        { key: "okand", quantity: 3 },
      ],
      tillagg: [{ label: "Takstege", quantity: 2 }],
    },
    prices,
    seller: { name: "Herman", phone: "070-1" },
    documents: [
      { file_path: "a/foto.jpg", file_name: "foto.jpg", mime_type: "image/jpeg" },
      { file_path: "a/x.docx", file_name: "x.docx", mime_type: "application/msword" },
    ],
  });
  it("tar med material och moment men bara kända prisrader", () => {
    expect(c.materials.map((m) => m.label)).toEqual(["Betongpannor", "Snörasskydd"]);
    expect(c.scope.map((m) => m.label)).toEqual(["Betongpannor", "Takstege"]);
    expect(c.roof_area_kvm).toBe(120);
  });
  it("innehåller bara foton och pdf som bilagor och aldrig priser", () => {
    expect(c.attachments).toHaveLength(1);
    expect(JSON.stringify(c)).not.toMatch(/unit_price|marginal|total/);
  });
  it("kontaktperson är säljaren", () => {
    expect(c.contact.name).toBe("Herman");
  });
});

describe("pickNextSubcontractor", () => {
  const cands = [
    { id: "a", priority: 100, created_at: "2026-01-02", missing: [] },
    { id: "b", priority: 50, created_at: "2026-01-03", missing: [] },
    { id: "c", priority: 10, created_at: "2026-01-01", missing: ["f_skatt"] },
  ];
  it("väljer lägst prioritet bland godkända", () => expect(pickNextSubcontractor(cands, new Set())).toBe("b"));
  it("hoppar över redan tillfrågade", () => expect(pickNextSubcontractor(cands, new Set(["b"]))).toBe("a"));
  it("ger null när ingen finns", () => expect(pickNextSubcontractor(cands, new Set(["a", "b"]))).toBeNull());
});

describe("offerExpiry", () => {
  it("lägger till timmar", () => {
    expect(offerExpiry(new Date("2026-09-27T10:00:00Z"), 24).toISOString()).toBe("2026-09-28T10:00:00.000Z");
  });
});

describe("upcomingExpiries", () => {
  const today = new Date("2026-09-27T08:00:00Z");
  const subs = [
    { company_name: "UE1", active: true, insurance_expires_at: "2026-10-15", id06_valid_until: "2027-06-01", a1_valid_until: "2026-09-01", is_posted_worker: false },
    { company_name: "UE2", active: false, insurance_expires_at: "2026-09-01", id06_valid_until: null, a1_valid_until: null, is_posted_worker: false },
    { company_name: "UE3", active: true, insurance_expires_at: "2028-01-01", id06_valid_until: "2026-09-20", a1_valid_until: "2026-10-01", is_posted_worker: true },
  ];
  const r = upcomingExpiries(subs, [{ company_name: "UE1", doc_type: "avtal", valid_until: "2026-12-31" }], today);
  it("hittar utgående, hoppar över inaktiva och tar A1 bara vid utstationering", () => {
    expect(r.map((x) => `${x.subcontractor}:${x.what}`)).toEqual(["UE3:ID06", "UE3:A1-intyg", "UE1:Ansvarsförsäkring"]);
    expect(r[0].daysLeft).toBe(-7);
  });
});
