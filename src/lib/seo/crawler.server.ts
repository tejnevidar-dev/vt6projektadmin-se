/** Enkel, beroendefri crawler för den egna webbplatsen (server-only). */
import { auditIssues, healthScore, type PageAudit, type SeoIssue } from "./analysis";

export const SITE_ORIGIN = "https://roslagstak.se";

const UA = "admin.vt6-seo-bot/1.0 (+https://vt6projektadmin.se)";

async function fetchText(url: string, timeoutMs = 15000): Promise<{ status: number; text: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" }, signal: ctrl.signal, redirect: "follow" });
    const text = await res.text();
    return { status: res.status, text };
  } finally {
    clearTimeout(t);
  }
}

export async function fetchRobots(origin = SITE_ORIGIN) {
  try {
    const { status, text } = await fetchText(`${origin}/robots.txt`);
    const sitemaps = [...text.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]!);
    const blocksAll = /^\s*user-agent:\s*\*\s*$[\s\S]*?^\s*disallow:\s*\/\s*$/im.test(text);
    return { ok: status < 400, status, sitemaps, blocksAll, raw: text.slice(0, 4000) };
  } catch (e) {
    return { ok: false, status: 0, sitemaps: [] as string[], blocksAll: false, raw: "", error: (e as Error).message };
  }
}

export async function fetchSitemapUrls(origin = SITE_ORIGIN, seed?: string[]): Promise<{ urls: string[]; error: string | null }> {
  const queue = seed?.length ? [...seed] : [`${origin}/sitemap.xml`];
  const seen = new Set<string>();
  const urls = new Set<string>();
  let error: string | null = null;
  while (queue.length && seen.size < 10) {
    const sm = queue.shift()!;
    if (seen.has(sm)) continue;
    seen.add(sm);
    try {
      const { status, text } = await fetchText(sm);
      if (status >= 400) {
        error = `Sitemap ${sm} svarade ${status}`;
        continue;
      }
      const isIndex = /<sitemapindex/i.test(text);
      for (const m of text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
        const loc = m[1]!;
        if (isIndex) queue.push(loc);
        else urls.add(loc.split("#")[0]!);
      }
    } catch (e) {
      error = (e as Error).message;
    }
  }
  return { urls: [...urls], error };
}

function decode(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? decode(m[2] ?? m[3] ?? m[4] ?? "") : null;
}

export function parseHtml(url: string, html: string, status: number, inSitemap: boolean): Omit<PageAudit, "issues" | "healthScore"> {
  const head = html;
  const title = (head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
  let metaDescription: string | null = null;
  let robots: string | null = null;
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const name = (attr(tag, "name") ?? "").toLowerCase();
    if (name === "description") metaDescription = attr(tag, "content");
    if (name === "robots") robots = attr(tag, "content");
  }
  const canonical =
    [...head.matchAll(/<link\b[^>]*>/gi)]
      .map((m) => m[0])
      .find((t) => (attr(t, "rel") ?? "").toLowerCase() === "canonical")
      ?.match(/href\s*=\s*("([^"]*)"|'([^']*)')/i)?.[2] ?? null;

  const h1 = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => decode(m[1]!.replace(/<[^>]+>/g, " ")));
  const headings = [...html.matchAll(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({
    tag: `h${m[1]}`,
    text: decode(m[2]!.replace(/<[^>]+>/g, " ")).slice(0, 160),
  }));

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const wordCount = decode(bodyText).split(/\s+/).filter((w) => w.length > 1).length;

  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const imagesMissingAlt = imgs.filter((t) => {
    const a = attr(t, "alt");
    return a == null || a === "";
  }).length;

  const origin = new URL(url).origin;
  const internalLinksOut = [
    ...new Set(
      [...html.matchAll(/<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)')/gi)]
        .map((m) => (m[2] ?? m[3] ?? "").trim())
        .filter((h) => h && !h.startsWith("#") && !/^(mailto|tel|javascript):/i.test(h))
        .map((h) => {
          try {
            return new URL(h, url).href.split("#")[0]!;
          } catch {
            return "";
          }
        })
        .filter((h) => h.startsWith(origin)),
    ),
  ];

  const structuredData = [
    ...new Set(
      [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].flatMap((m) => {
        try {
          const json = JSON.parse(m[1]!.trim());
          const arr = Array.isArray(json) ? json : json["@graph"] ? json["@graph"] : [json];
          return arr.map((n: any) => String(n?.["@type"] ?? "Unknown"));
        } catch {
          return ["Invalid JSON-LD"];
        }
      }),
    ),
  ];

  return {
    url,
    statusCode: status,
    title: title || null,
    metaDescription,
    h1,
    headings,
    wordCount,
    canonical,
    robots,
    inSitemap,
    internalLinksOut,
    imagesTotal: imgs.length,
    imagesMissingAlt,
    structuredData,
    htmlBytes: html.length,
  };
}

export async function crawlSite(origin = SITE_ORIGIN, maxPages = 40) {
  const robots = await fetchRobots(origin);
  const { urls: sitemapUrls, error: sitemapError } = await fetchSitemapUrls(origin, robots.sitemaps);
  const sitemapSet = new Set(sitemapUrls);

  const queue: string[] = sitemapUrls.length ? [...sitemapUrls] : [`${origin}/`];
  if (!queue.includes(`${origin}/`)) queue.unshift(`${origin}/`);

  const visited = new Set<string>();
  const audits: PageAudit[] = [];
  const brokenLinks: { from: string; to: string; status: number }[] = [];

  while (queue.length && audits.length < maxPages) {
    const url = queue.shift()!;
    if (visited.has(url) || !url.startsWith(origin)) continue;
    visited.add(url);
    try {
      const { status, text } = await fetchText(url);
      const parsed = parseHtml(url, text, status, sitemapSet.has(url));
      const issues = auditIssues(parsed);
      audits.push({ ...parsed, issues, healthScore: healthScore(issues) });
      for (const link of parsed.internalLinksOut) {
        if (!visited.has(link) && !queue.includes(link)) queue.push(link);
      }
    } catch (e) {
      const parsed = parseHtml(url, "", 0, sitemapSet.has(url));
      const issues: SeoIssue[] = [
        { code: "fetch_failed", severity: "critical", title: "Kunde inte hämtas", detail: (e as Error).message, fix: "Kontrollera att URL:en svarar och att servern är nåbar.", url },
      ];
      audits.push({ ...parsed, issues, healthScore: 0 });
    }
  }

  // interna inlänkar
  const inbound = new Map<string, number>();
  for (const a of audits) for (const l of a.internalLinksOut) if (l !== a.url) inbound.set(l, (inbound.get(l) ?? 0) + 1);
  for (const a of audits) a.internalLinksIn = inbound.get(a.url) ?? 0;

  return { robots, sitemapUrls, sitemapError, audits, brokenLinks, crawledAt: new Date().toISOString() };
}
