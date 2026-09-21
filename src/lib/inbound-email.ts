// Ren logik för mail som kommer in via info@roslagstak.se (Resend inbound). Ingen I/O här
// så att den går att enhetstesta; själva flödet ligger i routes/api/hooks/inbound-email.ts.

export interface ParsedAddress {
  name: string | null;
  email: string;
}

/** "Anna Svensson <anna@x.se>" -> { name, email }. Returnerar null om ingen giltig adress finns. */
export function parseAddress(raw: string | null | undefined): ParsedAddress | null {
  if (!raw) return null;
  const angle = raw.match(/^\s*"?([^"<]*?)"?\s*<([^<>\s]+@[^<>\s]+)>\s*$/);
  const email = (angle ? angle[2] : raw.trim()).toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) return null;
  const name = angle ? angle[1].trim() : "";
  return { name: name || null, email };
}

/** Resend kan ge headers som objekt eller lista -- normalisera till en gemen-nyckelad map. */
export function normalizeHeaders(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (h && typeof h === "object" && "name" in h && "value" in h) {
        out[String((h as any).name).toLowerCase()] = String((h as any).value);
      }
    }
  } else if (headers && typeof headers === "object") {
    for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
      out[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : String(v);
    }
  }
  return out;
}

/** Egna domäner: mail från oss själva (systemmail, svar, testutskick) blir aldrig leads. */
const OWN_DOMAINS = ["roslagstak.se", "vt6projektadmin.se"];

const AUTOMATED_LOCALPART = /^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounces?|notifications?|newsletter|news|marketing)([+._-]|$)/i;

/** True för nyhetsbrev, studsar, autosvar och mail från oss själva. */
export function shouldSkipEmail(
  from: ParsedAddress | null,
  headers: Record<string, string>,
): string | null {
  if (!from) return "ingen_giltig_avsandare";
  const domain = from.email.split("@")[1] ?? "";
  if (OWN_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return "egen_doman";
  if (AUTOMATED_LOCALPART.test(from.email.split("@")[0])) return "automatisk_avsandare";
  const auto = headers["auto-submitted"];
  if (auto && auto.toLowerCase() !== "no") return "auto_submitted";
  if (/^(bulk|list|junk)$/i.test(headers["precedence"] ?? "")) return "massutskick";
  if (headers["list-unsubscribe"]) return "nyhetsbrev";
  if (headers["x-autoreply"] || headers["x-autorespond"]) return "autosvar";
  return null;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/** Första svenska telefonnumret i texten (mobil eller fast), annars null. */
export function extractPhone(text: string): string | null {
  const m = text.match(/(?:\+46|0046|\b0)[\s-]?[1-9](?:[\s-]?\d){6,9}/);
  return m ? m[0].replace(/\s+/g, " ").trim() : null;
}

export function displayNameFor(addr: ParsedAddress): string {
  if (addr.name) return addr.name;
  const local = addr.email.split("@")[0].replace(/[._-]+/g, " ").trim();
  return local ? local.replace(/\b\w/g, (c) => c.toUpperCase()) : addr.email;
}

const MAX_BODY = 4000;

export function bodyText(email: { text?: string | null; html?: string | null }): string {
  const raw = email.text?.trim() || (email.html ? htmlToText(email.html) : "");
  return raw.length > MAX_BODY ? `${raw.slice(0, MAX_BODY)}\n[... avkortat]` : raw;
}

export function buildLeadNotes(args: {
  fromEmail: string;
  subject: string | null;
  body: string;
  attachmentNames: string[];
}): string {
  const lines = ["📧 Inkommande mail till info@roslagstak.se", `E-post: ${args.fromEmail}`];
  if (args.subject) lines.push(`Ämne: ${args.subject}`);
  if (args.attachmentNames.length) lines.push(`Bilagor: ${args.attachmentNames.join(", ")}`);
  if (args.body) lines.push("", args.body);
  return lines.join("\n");
}

export function buildActivityDescription(subject: string | null, body: string): string {
  const snippet = body.replace(/\s+/g, " ").slice(0, 300);
  return `📧 Nytt mail${subject ? `: ${subject}` : ""}${snippet ? ` — ${snippet}` : ""}`;
}

/** Skyddar ilike mot jokertecken i e-postadresser (t.ex. understreck). */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
