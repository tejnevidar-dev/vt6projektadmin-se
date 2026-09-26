// Ren logik för arbetsordern (ingen I/O): innehåll, tvåspråkiga texter och val av nästa UE.
// Mot UE används företagsnamnet VT6 Invest. Ingen kundpris eller marginal får hamna i innehållet.

export const COMPANY_NAME_TO_UE = "VT6 Invest";

export interface WorkOrderItem {
  label: string;
  quantity: number;
  unit: string;
}

export interface WorkOrderContent {
  version: 1;
  offer_number: string | null;
  address: string;
  municipality: string | null;
  job_type: string | null;
  roof_area_kvm: number | null;
  ranndalar_meter: number | null;
  /** Moment som ska utföras (från kalkylens tillägg och arbete). */
  scope: WorkOrderItem[];
  /** Material som VT6 Invest levererar till arbetsplatsen. */
  materials: WorkOrderItem[];
  contact: { name: string; phone: string | null; email: string | null };
  /** Takkontrollens foton/protokoll i den mån de finns (sökvägar i lead-documents). */
  attachments: { path: string; name: string; mime: string | null }[];
  notes: string | null;
  storeys: number | null;
  pitch: string | null;
  /** Nycklar ur STANDARD_TASK_KEYS som alltid står med på arbetsordern. */
  standard_tasks: string[];
  /** Prisberäkning per moment enligt Bilaga 1 (fylls när UE-prislistan finns). */
  price_breakdown: { label: string; amount: number }[];
  material_delivery_date: string | null;
  skip_scaffold: { supplier: string | null; delivery: string | null; pickup: string | null } | null;
  bas_p: string | null;
  bas_u: string | null;
  liquidated_damages: { per_day: number | null; cap_pct: number | null } | null;
  payment: { days: number | null; retention_pct: number | null; retention_days: number | null } | null;
}

interface CalcLike {
  roof_area_kvm?: number | string | null;
  ranndalar_meter?: number | string | null;
  material_key?: string | null;
  plat_items?: { key: string; quantity: number }[] | null;
  tillagg?: { label: string; quantity: number }[] | null;
}
interface PriceLike {
  key: string;
  label: string;
  unit: string;
}
interface DocLike {
  file_path: string;
  file_name: string;
  mime_type: string | null;
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function buildWorkOrderContent(input: {
  offerNumber?: string | null;
  address: string;
  municipality?: string | null;
  jobType?: string | null;
  calc: CalcLike | null;
  prices: PriceLike[];
  seller: { name: string; phone?: string | null; email?: string | null };
  documents: DocLike[];
  notes?: string | null;
  /** Standardvärden och ev. per-arbetsorder-värden för villkorsfälten. */
  extras?: Partial<Pick<WorkOrderContent, "storeys" | "pitch" | "price_breakdown" | "material_delivery_date" | "skip_scaffold" | "bas_p" | "bas_u" | "liquidated_damages" | "payment">>;
}): WorkOrderContent {
  const byKey = new Map(input.prices.map((p) => [p.key, p]));
  const area = num(input.calc?.roof_area_kvm);
  const materials: WorkOrderItem[] = [];
  const scope: WorkOrderItem[] = [];

  const mat = input.calc?.material_key ? byKey.get(input.calc.material_key) : undefined;
  if (mat && area) materials.push({ label: mat.label, quantity: area, unit: mat.unit });
  for (const it of input.calc?.plat_items ?? []) {
    const p = byKey.get(it.key);
    if (p && it.quantity > 0) materials.push({ label: p.label, quantity: Number(it.quantity), unit: p.unit });
  }
  if (mat && area) scope.push({ label: mat.label, quantity: area, unit: "kvm" });
  for (const t of input.calc?.tillagg ?? []) {
    if (t.label && Number(t.quantity) > 0) scope.push({ label: t.label, quantity: Number(t.quantity), unit: "st" });
  }

  return {
    version: 1,
    offer_number: input.offerNumber ?? null,
    address: input.address,
    municipality: input.municipality ?? null,
    job_type: input.jobType ?? null,
    roof_area_kvm: area,
    ranndalar_meter: num(input.calc?.ranndalar_meter),
    scope,
    materials,
    contact: { name: input.seller.name, phone: input.seller.phone ?? null, email: input.seller.email ?? null },
    attachments: input.documents
      .filter((d) => (d.mime_type ?? "").startsWith("image/") || d.mime_type === "application/pdf")
      .map((d) => ({ path: d.file_path, name: d.file_name, mime: d.mime_type })),
    notes: input.notes ?? null,
    storeys: input.extras?.storeys ?? null,
    pitch: input.extras?.pitch ?? null,
    standard_tasks: [...STANDARD_TASK_KEYS],
    price_breakdown: input.extras?.price_breakdown ?? [],
    material_delivery_date: input.extras?.material_delivery_date ?? null,
    skip_scaffold: input.extras?.skip_scaffold ?? null,
    bas_p: input.extras?.bas_p ?? null,
    bas_u: input.extras?.bas_u ?? null,
    liquidated_damages: input.extras?.liquidated_damages ?? null,
    payment: input.extras?.payment ?? null,
  };
}

export type Lang = "sv" | "en";

export const WO_TEXT: Record<Lang, Record<string, string>> = {
  sv: {
    title: "Arbetsorder",
    from: `Beställare: ${COMPANY_NAME_TO_UE}`,
    address: "Adress",
    scope: "Omfattning",
    standardTasks: "Standardmoment",
    area: "Takyta",
    storeys: "Antal våningar",
    pitch: "Taklutning",
    valleys: "Ränndalar (meter)",
    materials: "Material som levereras av beställaren",
    materialDelivery: "Leveransdag för material",
    none: "Inget angivet",
    contact: "Kontaktperson",
    price: "Fast pris för arbetet (exkl. moms)",
    breakdown: "Prisberäkning",
    start: "Startdatum",
    end: "Senast färdigt",
    attachments: "Bilagor (takkontroll)",
    notes: "Övrigt",
    accept: "Acceptera uppdraget",
    decline: "Avböj",
    valid: "Svara senast",
    binding: "Genom att acceptera binds det fasta priset.",
    orderNo: "Arbetsorder nr",
    subcontractor: "Underentreprenör",
    orgNo: "org.nr",
    acceptedBy: "Accepterad av",
    acceptedAt: "Datum och tid",
    personnel: "Personal på plats",
    termsTitle: "Villkor",
    termsCheckbox: "Jag har läst villkoren och accepterar arbetsordern enligt ramavtalet",
    frameworkLink: "Läs ramavtalet",
    employee: "Anställd",
    selfEmployed: "Egen företagare med F-skatt",
    yourName: "Ditt namn",
    addPerson: "Lägg till person",
    personName: "Namn (visas bara internt)",
    footer: "Arbetsorder",
    page: "sida",
    task_rivning: "Rivning",
    task_underlagstak: "Underlagstak",
    task_lakt: "Ströläkt/bärläkt",
    task_taktackning: "Taktäckning",
    task_nock: "Nock/vindskivor",
  },
  en: {
    title: "Work order",
    from: `Client: ${COMPANY_NAME_TO_UE}`,
    address: "Address",
    scope: "Scope of work",
    standardTasks: "Standard tasks",
    area: "Roof area",
    storeys: "Number of storeys",
    pitch: "Roof pitch",
    valleys: "Valleys (metres)",
    materials: "Materials supplied by the client",
    materialDelivery: "Material delivery date",
    none: "None specified",
    contact: "Contact person",
    price: "Fixed price for the work (excl. VAT)",
    breakdown: "Price calculation",
    start: "Start date",
    end: "Completion no later than",
    attachments: "Attachments (roof inspection)",
    notes: "Notes",
    accept: "Accept the assignment",
    decline: "Decline",
    valid: "Reply by",
    binding: "By accepting, the fixed price is binding.",
    orderNo: "Work order no.",
    subcontractor: "Subcontractor",
    orgNo: "reg. no.",
    acceptedBy: "Accepted by",
    acceptedAt: "Date and time",
    personnel: "Personnel on site",
    termsTitle: "Terms",
    termsCheckbox: "I have read the terms and accept the work order under the framework agreement",
    frameworkLink: "Read the framework agreement",
    employee: "Employee",
    selfEmployed: "Self-employed with F-skatt",
    yourName: "Your name",
    addPerson: "Add person",
    personName: "Name (internal only)",
    footer: "Work order",
    page: "page",
    task_rivning: "Demolition",
    task_underlagstak: "Underlay roof",
    task_lakt: "Battens",
    task_taktackning: "Roof covering",
    task_nock: "Ridge/barge boards",
  },
};

export const STANDARD_TASK_KEYS = ["rivning", "underlagstak", "lakt", "taktackning", "nock"] as const;

export interface TermsContext {
  subcontractorName: string | null;
  frameworkDate: string | null;
  content: Pick<WorkOrderContent, "liquidated_damages" | "payment" | "skip_scaffold" | "bas_p" | "bas_u" | "contact">;
}

const fmtPct = (n: number) => `${String(n).replace(".", ",")} %`;

/** Villkorsraderna (rad 4, 7, 11, 13-18 och 22 i arbetsordermallen). Används av PDF och acceptsida. */
export function termsLines(lang: Lang, ctx: TermsContext): string[] {
  const c = ctx.content;
  const ue = ctx.subcontractorName ?? (lang === "sv" ? "underentreprenören" : "the Subcontractor");
  const sv = lang === "sv";
  const out: string[] = [];

  out.push(
    sv
      ? `Gäller enligt Ramavtal för underentreprenad mellan ${COMPANY_NAME_TO_UE} AB och ${ue}${ctx.frameworkDate ? `, daterat ${ctx.frameworkDate}` : ""}, med bilagor 1-6.`
      : `Applies under the Framework Agreement for subcontracting between ${COMPANY_NAME_TO_UE} AB and ${ue}${ctx.frameworkDate ? `, dated ${ctx.frameworkDate}` : ""}, with appendices 1-6.`,
  );
  out.push(
    sv
      ? "Fast pris för ENDAST ARBETE, exkl. moms, omvänd betalningsskyldighet. Material, container och ställning tillhandahålls och bekostas av beställaren och ingår inte."
      : "Fixed price for LABOUR ONLY, excl. VAT, reverse charge. Materials, skip and scaffolding are supplied and paid for by the client and are not included.",
  );
  const ld = c.liquidated_damages;
  out.push(
    ld && ld.per_day != null && ld.cap_pct != null
      ? sv
        ? `Vite vid försening: ${ld.per_day} kr per arbetsdag, högst ${fmtPct(ld.cap_pct)} av priset (ramavtal 5.2).`
        : `Liquidated damages for delay: SEK ${ld.per_day} per working day, max ${fmtPct(ld.cap_pct)} of the price (framework agreement 5.2).`
      : sv
        ? "Vite vid försening enligt ramavtalet 5.2."
        : "Liquidated damages for delay under framework agreement 5.2.",
  );
  const sk = c.skip_scaffold;
  if (sk && (sk.supplier || sk.delivery || sk.pickup)) {
    out.push(
      sv
        ? `Container och ställning: ${[sk.supplier, sk.delivery ? `levereras ${sk.delivery}` : "", sk.pickup ? `hämtas ${sk.pickup}` : ""].filter(Boolean).join(", ")}.`
        : `Skip and scaffolding: ${[sk.supplier, sk.delivery ? `delivered ${sk.delivery}` : "", sk.pickup ? `collected ${sk.pickup}` : ""].filter(Boolean).join(", ")}.`,
    );
  } else {
    out.push(sv ? "Container och ställning tillhandahålls av beställaren, tider meddelas av kontaktpersonen." : "Skip and scaffolding are provided by the client; times are announced by the contact person.");
  }
  out.push(
    sv
      ? `All kundkontakt om pris och extra arbeten går via ${COMPANY_NAME_TO_UE}. Kontaktperson: ${[c.contact.name, c.contact.phone].filter(Boolean).join(", ")}.`
      : `All customer contact about price and extra work goes through ${COMPANY_NAME_TO_UE}. Contact person: ${[c.contact.name, c.contact.phone].filter(Boolean).join(", ")}.`,
  );
  const bas = [c.bas_p ? `BAS-P ${c.bas_p}` : "", c.bas_u ? `BAS-U ${c.bas_u}` : ""].filter(Boolean).join(", ");
  out.push(
    sv
      ? `Säkerhet: taket ska vara tätt varje kväll. Fallskydd alltid. Se Bilaga 2.${bas ? ` Samordningsansvar: ${bas}.` : ""}`
      : `Safety: the roof must be watertight every evening. Fall protection at all times. See Appendix 2.${bas ? ` Coordination responsibility: ${bas}.` : ""}`,
  );
  out.push(
    sv
      ? "Jobbet kan inte markeras klart utan foton och egenkontroll enligt Bilaga 3, inklusive foto på tätat tak varje kväll."
      : "The job cannot be marked complete without photos and self-inspection under Appendix 3, including a photo of the sealed roof every evening.",
  );
  out.push(
    sv
      ? "ÄTA ersätts bara efter skriftligt förhandsgodkännande i systemet (Bilaga 4). Kundens beställningar hänvisas till " + COMPANY_NAME_TO_UE + "."
      : "Change work is compensated only after prior written approval in the system (Appendix 4). Orders from the customer are referred to " + COMPANY_NAME_TO_UE + ".",
  );
  const p = c.payment;
  const days = p?.days != null ? `${p.days} dagar` : null;
  const retention = p?.retention_pct != null && p?.retention_days != null;
  out.push(
    sv
      ? `Fakturering efter godkänd slutkontroll. Betalning ${days ? `${days} efter` : "efter"} korrekt faktura och komplett lönebevis (Bilaga 5).${retention ? ` ${fmtPct(p!.retention_pct!)} hålls inne i ${p!.retention_days} dagar.` : ""}`
      : `Invoicing after approved final inspection. Payment ${p?.days != null ? `${p.days} days after` : "after"} a correct invoice and complete proof of wages (Appendix 5).${retention ? ` ${fmtPct(p!.retention_pct!)} is retained for ${p!.retention_days} days.` : ""}`,
  );
  out.push(
    sv
      ? `Genom att acceptera ingår ${ue} avtal om denna arbetsorder till angivet fast pris och angivna tider, på villkoren i ramavtalet.`
      : `By accepting, ${ue} enters into an agreement on this work order at the stated fixed price and times, on the terms of the framework agreement.`,
  );
  return out;
}

/** Standardtypsnitten klarar bara WinAnsi. Vanliga typografiska tecken mappas, resten blir "?". */
export function toWinAnsi(text: string): string {
  return text
    .replace(/[–—−]/g, "-")
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/…/g, "...")
    .replace(/[   ]/g, " ")
    .replace(/·/g, "|")
    .replace(/[^ -ÿ]/g, "?");
}

/** Bryter en text i rader som ryms i maxWidth (mäts med `measure`). Ord längre än raden bryts hårt. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let cur = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      let w = word;
      while (measure(w) > maxWidth && w.length > 1) {
        let cut = w.length - 1;
        while (cut > 1 && measure(w.slice(0, cut)) > maxWidth) cut--;
        if (cur) {
          lines.push(cur);
          cur = "";
        }
        lines.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      const next = cur ? `${cur} ${w}` : w;
      if (measure(next) <= maxWidth) cur = next;
      else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    lines.push(cur);
  }
  return lines;
}

/** Bindande accept kräver kryssruta, namn och minst en person på plats. */
export interface Personnel {
  name: string;
  status: "employee" | "self_employed";
}
export function validateAcceptance(input: {
  termsAccepted?: boolean;
  acceptedBy?: string;
  personnel?: Personnel[];
}): string | null {
  if (!input.termsAccepted) return "terms_required";
  if (!input.acceptedBy || input.acceptedBy.trim().length < 2) return "name_required";
  const p = (input.personnel ?? []).filter((x) => x.name?.trim());
  if (p.length < 1) return "personnel_required";
  if (p.some((x) => x.status !== "employee" && x.status !== "self_employed")) return "personnel_status_invalid";
  return null;
}

export interface SubcontractorCandidate {
  id: string;
  priority: number;
  created_at: string;
  missing: string[];
}

/** Nästa UE i turordning: godkänd (inget saknas), inte redan tillfrågad, lägst prioritetstal först. */
export function pickNextSubcontractor(cands: SubcontractorCandidate[], tried: Set<string>): string | null {
  const ok = cands
    .filter((c) => c.missing.length === 0 && !tried.has(c.id))
    .sort((a, b) => a.priority - b.priority || a.created_at.localeCompare(b.created_at));
  return ok[0]?.id ?? null;
}

export function offerExpiry(now: Date, hours: number): Date {
  return new Date(now.getTime() + Math.max(1, hours) * 3600000);
}

export const REQUIREMENT_LABELS: Record<string, string> = {
  registerpost: "saknar registerpost",
  aktiv: "är inte aktiv",
  status: "pipelinestatus måste vara Provjobb eller Aktiv",
  provjobb_pagar: "provjobb: ett jobb pågår redan (max ett åt gången)",
  utstationering_anmalan: "anmälan om utstationering till Arbetsmiljöverket",
  kronofogden: "skuld hos Kronofogden över gränsen",
  inloggning: "saknar inloggning",
  f_skatt: "F-skatt (kontroll max 30 dagar gammal)",
  forsakring: "giltig ansvarsförsäkring",
  avtal: "signerat UE-avtal",
  id06: "giltigt ID06",
  a1: "giltigt A1-intyg (utstationering)",
};

export interface ExpiryItem {
  subcontractor: string;
  what: string;
  date: string;
  daysLeft: number;
}

/** Sådant som går ut inom `days` dagar (eller redan gått ut), för 30-dagarslarmet. */
export function upcomingExpiries(
  subs: {
    company_name: string;
    active: boolean;
    insurance_expires_at: string | null;
    id06_valid_until: string | null;
    a1_valid_until: string | null;
    is_posted_worker: boolean;
  }[],
  docs: { company_name: string; doc_type: string; valid_until: string | null }[],
  today: Date,
  days = 30,
): ExpiryItem[] {
  const out: ExpiryItem[] = [];
  const startOfDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const add = (subcontractor: string, what: string, date: string | null) => {
    if (!date) return;
    const left = Math.round((Date.parse(`${date}T00:00:00Z`) - startOfDay) / 86400000);
    if (left <= days) out.push({ subcontractor, what, date, daysLeft: left });
  };
  for (const s of subs) {
    if (!s.active) continue;
    add(s.company_name, "Ansvarsförsäkring", s.insurance_expires_at);
    add(s.company_name, "ID06", s.id06_valid_until);
    if (s.is_posted_worker) add(s.company_name, "A1-intyg", s.a1_valid_until);
  }
  for (const d of docs) add(d.company_name, `Dokument (${d.doc_type})`, d.valid_until);
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}
