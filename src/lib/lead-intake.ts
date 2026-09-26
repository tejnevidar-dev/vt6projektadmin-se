// Ren logik för leadintag (ingen I/O): dubblettmatchning, säljarrouting, konfig och
// öppettider för larm. Själva flödet ligger i lead-intake.server.ts.

export interface RoutingRule {
  sellerId: string;
  /** Delsträngar (gemener) som matchas mot adress/ort i förfrågan. */
  match: string[];
}

export interface LeadIntakeConfig {
  /** Vilka användare som får notis i CRM:et. null = alla admins. */
  adminUserIds: string[] | null;
  /** Dit notismailen till admin skickas. */
  adminEmail: string;
  /** Timmar utan kontakt innan påminnelse skickas. */
  slaHours: number;
  /** Timmar utan några nya leads (dagtid) innan tystnadslarm skickas. */
  silenceHours: number;
  /** Säljare som får leads som inte matchar någon område-regel. */
  defaultSellerId: string | null;
  rules: RoutingRule[];
}

export const DEFAULT_CONFIG: LeadIntakeConfig = {
  adminUserIds: null,
  adminEmail: "vidar@roslagstak.se",
  slaHours: 2,
  silenceHours: 12,
  defaultSellerId: null,
  rules: [],
};

const asStr = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const asPosNum = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;

/** Tolerant tolkning av app_settings-värdet (key 'lead_intake_config'). */
export function parseConfig(raw: unknown): LeadIntakeConfig {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const ids = Array.isArray(o.admin_user_ids)
    ? o.admin_user_ids.filter((x): x is string => typeof x === "string" && x.length > 0)
    : null;
  const rules: RoutingRule[] = Array.isArray(o.rules)
    ? o.rules.flatMap((r) => {
        if (!r || typeof r !== "object") return [];
        const rr = r as Record<string, unknown>;
        const sellerId = asStr(rr.seller_id);
        const match = Array.isArray(rr.match)
          ? rr.match.filter((m): m is string => typeof m === "string" && m.trim().length > 0).map((m) => m.trim().toLowerCase())
          : [];
        return sellerId && match.length ? [{ sellerId, match }] : [];
      })
    : [];
  return {
    adminUserIds: ids && ids.length ? ids : null,
    adminEmail: asStr(o.admin_email) ?? DEFAULT_CONFIG.adminEmail,
    slaHours: asPosNum(o.sla_hours, DEFAULT_CONFIG.slaHours),
    silenceHours: asPosNum(o.silence_hours, DEFAULT_CONFIG.silenceHours),
    defaultSellerId: asStr(o.default_seller_id),
    rules,
  };
}

/** Första regeln vars sökord finns i texten vinner, annars standardsäljaren. */
export function pickSeller(cfg: LeadIntakeConfig, text: string): string | null {
  const hay = text.toLowerCase();
  for (const rule of cfg.rules) {
    if (rule.match.some((m) => hay.includes(m))) return rule.sellerId;
  }
  return cfg.defaultSellerId;
}

/** Jämförbar nyckel för svenska telefonnummer (07x-, +46-, 0046-format ger samma nyckel). */
export function phoneKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("0046")) d = d.slice(4);
  else if (d.startsWith("46") && d.length >= 10) d = d.slice(2);
  d = d.replace(/^0+/, "");
  return d.length >= 7 ? d.slice(-9) : null;
}

export const emailKey = (raw: string | null | undefined) => {
  const e = raw?.trim().toLowerCase();
  return e && e.includes("@") ? e : null;
};

/** Hittar en befintlig lead med samma e-post eller telefonnummer. */
export function findDuplicate<T extends { email: string | null; phone: string | null }>(
  candidates: T[],
  input: { email?: string | null; phone?: string | null },
): T | null {
  const ek = emailKey(input.email);
  const pk = phoneKey(input.phone);
  if (!ek && !pk) return null;
  return (
    candidates.find((c) => (ek && emailKey(c.email) === ek) || (pk && phoneKey(c.phone) === pk)) ?? null
  );
}

export function stockholmHour(d: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", hour12: false, timeZone: "Europe/Stockholm" })
    .formatToParts(d)
    .find((p) => p.type === "hour")?.value;
  return Number(h) % 24;
}

/** Tystnadslarm skickas bara dagtid så det inte väcker någon över natten. */
export const isBusinessHour = (d: Date = new Date()) => {
  const h = stockholmHour(d);
  return h >= 8 && h < 21;
};

/** Jämförelse i konstant tid för hemliga nycklar. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Tom eller blank e-post (t.ex. valfritt fält i formuläret) blir null; annars trimmad adress. */
export const normalizeEmail = (raw: string | null | undefined): string | null => {
  const e = raw?.trim();
  return e ? e : null;
};
