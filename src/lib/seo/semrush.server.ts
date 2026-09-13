/**
 * Semrush (server-only), called directly against Semrush's own API.
 * Ger sökvolym/difficulty per keyword, backlinkprofil och konkurrentdata.
 *
 * NOTE: previously proxied through Lovable's connector gateway, which exposed these
 * as friendly REST-style paths (e.g. "/keywords/phrase_these"). Semrush's real API is
 * flat/query-param based (?type=phrase_these&key=...). Mapped 1:1 by "type" below —
 * verify each call still returns the expected shape after the Lovable exit, since this
 * mapping wasn't guaranteed identical to Lovable's internal translation.
 */

const GATEWAY = "https://api.semrush.com";

export function semrushConfigured(): boolean {
  return Boolean(process.env["SEMRUSH_API_KEY"]);
}

type Table = Record<string, string>[];

async function call(type: string, params: Record<string, string>): Promise<Table> {
  if (!semrushConfigured()) throw new Error("Semrush är inte anslutet.");
  const qs = new URLSearchParams({ ...params, type, key: process.env["SEMRUSH_API_KEY"]! }).toString();
  const res = await fetch(`${GATEWAY}/?${qs}`);
  const text = await res.text();
  if (!res.ok) {
    if (/LIMIT EXCEEDED/i.test(text)) throw new Error("Semrush-kvoten är slut – uppgradera planen eller vänta tills kvoten återställs.");
    throw new Error(`Semrush-anropet misslyckades [${res.status}]: ${text.slice(0, 300)}`);
  }
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Kunde inte tolka svaret från Semrush.");
  }
  if (json?.error) throw new Error(`Semrush: ${json.error}`);
  const cols: string[] = json?.data?.columnNames ?? [];
  const rows: any[] = json?.data?.rows ?? [];
  return rows.map((r) => {
    if (Array.isArray(r)) {
      const o: Record<string, string> = {};
      cols.forEach((c, i) => (o[c] = String(r[i] ?? "")));
      return o;
    }
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(r ?? {})) o[k] = String(v ?? "");
    return o;
  });
}

const num = (v: string | undefined) => {
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const pick = (row: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) {
    const hit = Object.keys(row).find((c) => c.toLowerCase() === k.toLowerCase());
    if (hit && row[hit] !== "") return row[hit];
  }
  return undefined;
};

export type SemrushKeyword = { phrase: string; volume: number; cpc: number; competition: number; difficulty: number | null };

/** Sökvolym m.m. för upp till 100 frasers i taget. */
export async function keywordMetrics(phrases: string[], database = "se"): Promise<SemrushKeyword[]> {
  const unique = [...new Set(phrases.map((p) => p.trim().toLowerCase()).filter(Boolean))].slice(0, 100);
  if (!unique.length) return [];
  const rows = await call("phrase_these", {
    phrase: unique.join(";"),
    database,
    export_columns: "Ph,Nq,Cp,Co,Kd",
    display_limit: "100",
  });
  return rows.map((r) => ({
    phrase: String(pick(r, "Keyword", "Ph", "phrase") ?? "").toLowerCase(),
    volume: num(pick(r, "Search Volume", "Nq", "volume")),
    cpc: num(pick(r, "CPC", "Cp")),
    competition: num(pick(r, "Competition", "Co")),
    difficulty: pick(r, "Keyword Difficulty Index", "Kd") ? num(pick(r, "Keyword Difficulty Index", "Kd")) : null,
  }));
}

export type SemrushBacklinks = {
  authorityScore: number;
  totalBacklinks: number;
  referringDomains: number;
  referringIps: number;
  follow: number;
  nofollow: number;
  topDomains: { domain: string; authority: number; backlinks: number }[];
};

export async function backlinkProfile(domain: string): Promise<SemrushBacklinks> {
  // NOTE: Semrush's Backlinks Analytics API has historically lived on a separate
  // endpoint from the main Domain/Keyword API. If these two calls fail while
  // keywordMetrics/domainOverview work fine, that's the likely cause — check
  // Semrush's current API docs for the right backlinks base URL.
  const [overview, refdomains] = await Promise.all([
    call("backlinks_overview", {
      target: domain,
      target_type: "root_domain",
      export_columns: "ascore,total,domains_num,urls_num,ips_num,follows_num,nofollows_num",
    }),
    call("backlinks_refdomains", {
      target: domain,
      target_type: "root_domain",
      export_columns: "domain_ascore,domain,backlinks_num",
      display_limit: "10",
    }).catch(() => [] as Table),
  ]);
  const o = overview[0] ?? {};
  return {
    authorityScore: num(pick(o, "Authority Score", "ascore")),
    totalBacklinks: num(pick(o, "Total", "total")),
    referringDomains: num(pick(o, "Domains Num", "domains_num")),
    referringIps: num(pick(o, "Ips Num", "ips_num")),
    follow: num(pick(o, "Follows Num", "follows_num")),
    nofollow: num(pick(o, "Nofollows Num", "nofollows_num")),
    topDomains: refdomains.map((r) => ({
      domain: String(pick(r, "Domain", "domain") ?? ""),
      authority: num(pick(r, "Domain Ascore", "domain_ascore")),
      backlinks: num(pick(r, "Backlinks Num", "backlinks_num")),
    })),
  };
}

export type SemrushDomain = { domain: string; organicKeywords: number; organicTraffic: number; organicCost: number; adsKeywords: number };

export async function domainOverview(domain: string, database = "se"): Promise<SemrushDomain> {
  const rows = await call("domain_ranks", {
    domain,
    database,
    export_columns: "Db,Dn,Or,Ot,Oc,Ad",
  });
  const r = rows.find((x) => (pick(x, "Database", "Db") ?? database) === database) ?? rows[0] ?? {};
  return {
    domain,
    organicKeywords: num(pick(r, "Organic Keywords", "Or")),
    organicTraffic: num(pick(r, "Organic Traffic", "Ot")),
    organicCost: num(pick(r, "Organic Cost", "Oc")),
    adsKeywords: num(pick(r, "Adwords Keywords", "Ad")),
  };
}

/** Organiska konkurrenter för domänen. */
export async function organicCompetitors(domain: string, database = "se", limit = 10) {
  const rows = await call("domain_domains", {
    domains: `*|or|${domain}`,
    database,
    export_columns: "Dn,Cr,Np,Or,Ot,Oc",
    display_limit: String(limit),
  }).catch(() => [] as Table);
  return rows.map((r) => ({
    domain: String(pick(r, "Domain", "Dn") ?? ""),
    commonKeywords: num(pick(r, "Common Keywords", "Np")),
    organicKeywords: num(pick(r, "Organic Keywords", "Or")),
    organicTraffic: num(pick(r, "Organic Traffic", "Ot")),
  }));
}
