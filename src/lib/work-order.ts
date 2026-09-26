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
  };
}

export type Lang = "sv" | "en";

export const WO_TEXT: Record<Lang, Record<string, string>> = {
  sv: {
    title: "Arbetsorder",
    from: `Beställare: ${COMPANY_NAME_TO_UE}`,
    address: "Adress",
    scope: "Omfattning",
    area: "Takyta",
    gutters: "Rännor (meter)",
    materials: "Material som levereras av beställaren",
    none: "Inget angivet",
    contact: "Kontaktperson",
    price: "Fast pris för arbetet (exkl. moms)",
    start: "Startdatum",
    attachments: "Bilagor (takkontroll)",
    notes: "Övrigt",
    accept: "Acceptera uppdraget",
    decline: "Avböj",
    valid: "Svara senast",
    binding: "Genom att acceptera binds det fasta priset.",
  },
  en: {
    title: "Work order",
    from: `Client: ${COMPANY_NAME_TO_UE}`,
    address: "Address",
    scope: "Scope of work",
    area: "Roof area",
    gutters: "Gutters (metres)",
    materials: "Materials supplied by the client",
    none: "None specified",
    contact: "Contact person",
    price: "Fixed price for the work (excl. VAT)",
    start: "Start date",
    attachments: "Attachments (roof inspection)",
    notes: "Notes",
    accept: "Accept the assignment",
    decline: "Decline",
    valid: "Reply by",
    binding: "By accepting, the fixed price is binding.",
  },
};

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
  status: "pipelinestatus är inte Aktiv",
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
