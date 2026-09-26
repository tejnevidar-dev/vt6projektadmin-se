import { describe, expect, it } from "vitest";
import {
  buildWorkOrderContent,
  offerExpiry,
  pickNextSubcontractor,
  termsLines,
  toWinAnsi,
  upcomingExpiries,
  validateAcceptance,
  wrapText,
  WO_TEXT,
} from "@/lib/work-order";

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

describe("arbetsorder: interna anteckningar och villkor", () => {
  const base = buildWorkOrderContent({
    address: "Storgatan 1",
    calc: null,
    prices: [],
    seller: { name: "Herman", phone: "070-1" },
    documents: [],
    notes: null,
  });
  it("etiketten för ränndalar är korrekt (inte rännor)", () => {
    expect(WO_TEXT.sv.valleys).toBe("Ränndalar (meter)");
    expect(WO_TEXT.en.valleys).toBe("Valleys (metres)");
    expect(WO_TEXT.sv.gutters).toBeUndefined();
  });
  it("standardmomenten står alltid med", () => {
    expect(base.standard_tasks).toEqual(["rivning", "underlagstak", "lakt", "taktackning", "nock"]);
  });
  it("villkorstexten refererar ramavtalet, endast arbete och accept", () => {
    const lines = termsLines("sv", { subcontractorName: "Tak AB", frameworkDate: "2026-09-30", content: base });
    const all = lines.join("\n");
    expect(all).toContain("Ramavtal för underentreprenad mellan VT6 Invest AB och Tak AB, daterat 2026-09-30, med bilagor 1-6");
    expect(all).toContain("ENDAST ARBETE");
    expect(all).toContain("ingår inte");
    expect(all).toContain("taket ska vara tätt vid varje arbetsdags slut");
    expect(all).toContain("får inte faktureras av underentreprenören");
    expect(all).toContain("Bilaga 6");
    expect(all).toContain("Genom att acceptera ingår Tak AB avtal");
    expect(termsLines("en", { subcontractorName: "Tak AB", frameworkDate: null, content: base }).join("\n")).toContain("LABOUR ONLY");
    const en = termsLines("en", { subcontractorName: "Tak AB", frameworkDate: null, content: base }).join(String.fromCharCode(10));
    expect(en).toContain("paid for by the Client");
    expect(en).toContain("in accordance with Appendix 3");
    expect(en).toContain("Requests from the customer");
  });
  it("vite och betalning visas med värden när de finns, annars 'enligt ramavtalet'", () => {
    const withVals = { ...base, liquidated_damages: { per_day: 500, cap_pct: 10 }, payment: { days: 30, retention_pct: 10, retention_days: 30 } };
    const a = termsLines("sv", { subcontractorName: "X", frameworkDate: null, content: withVals }).join("\n");
    expect(a).toContain("Vite vid försening som X orsakat: 500 kr per påbörjad arbetsdag, högst 10 % av priset");
    expect(a).toContain("Väder undantas om taket hålls tätt");
    expect(a).toContain("30 dagar efter korrekt faktura");
    expect(a).toContain("10 % hålls inne och betalas 30 dagar efter godkänd slutkontroll, om inga fel eller krav finns");
    expect(termsLines("sv", { subcontractorName: "X", frameworkDate: null, content: base }).join("\n")).toContain("Vite vid försening som underentreprenören orsakat enligt ramavtalet 5.2");
  });
});

describe("PDF-hjälpare", () => {
  it("tankstreck och citattecken mappas, okända tecken blir ?", () => {
    expect(toWinAnsi("Arbetsorder – nr 1 “x” …")).toBe('Arbetsorder - nr 1 "x" ...');
    expect(toWinAnsi("åäö É")).toBe("åäö É");
    expect(toWinAnsi("a中b")).toBe("a?b");
  });
  it("wrapText bryter långa rader och hårda långa ord", () => {
    const m = (s: string) => s.length;
    expect(wrapText("en två tre fyra", 8, m)).toEqual(["en två", "tre fyra"]);
    expect(wrapText("abcdefghij", 4, m).every((l) => l.length <= 4)).toBe(true);
    expect(wrapText("rad ett\nrad två", 20, m)).toEqual(["rad ett", "rad två"]);
  });
});

describe("validateAcceptance", () => {
  const ok = { termsAccepted: true, acceptedBy: "Anna Andersson", personnel: [{ name: "Anna", status: "employee" as const }] };
  it("kräver kryssruta, namn och minst en person", () => {
    expect(validateAcceptance(ok)).toBeNull();
    expect(validateAcceptance({ ...ok, termsAccepted: false })).toBe("terms_required");
    expect(validateAcceptance({ ...ok, acceptedBy: " " })).toBe("name_required");
    expect(validateAcceptance({ ...ok, personnel: [{ name: " ", status: "employee" }] })).toBe("personnel_required");
    expect(validateAcceptance({ ...ok, personnel: [{ name: "X", status: "annat" as any }] })).toBe("personnel_status_invalid");
  });
});

describe("isDayEndReminderTime", () => {
  it("bara kl. 17 Stockholmstid på vardagar, första tickan", async () => {
    const { isDayEndReminderTime } = await import("@/lib/work-order.server");
    expect(isDayEndReminderTime(new Date("2026-09-28T15:05:00Z"))).toBe(true); // mån 17:05 sommartid
    expect(isDayEndReminderTime(new Date("2026-09-28T15:15:00Z"))).toBe(false); // 17:15
    expect(isDayEndReminderTime(new Date("2026-09-28T14:05:00Z"))).toBe(false); // 16:05
    expect(isDayEndReminderTime(new Date("2026-09-26T15:05:00Z"))).toBe(false); // lördag
    expect(isDayEndReminderTime(new Date("2026-12-07T16:05:00Z"))).toBe(true); // mån 17:05 vintertid
  });
});
