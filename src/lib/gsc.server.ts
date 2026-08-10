const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";

export const TARGET_SITE = "https://roslagstak.se/";

function headers() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_SEARCH_CONSOLE_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("Search Console-anslutningen saknas");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectionKey,
  };
}

type SiteEntry = { siteUrl: string; permissionLevel?: string };

function coversTarget(siteUrl: string, target: URL) {
  if (siteUrl.startsWith("sc-domain:")) {
    const domain = siteUrl.slice("sc-domain:".length).toLowerCase();
    const host = target.hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  }
  try {
    return target.href.startsWith(new URL(siteUrl).href);
  } catch {
    return false;
  }
}

export type SiteResolution =
  | { status: "selected"; siteUrl: string }
  | { status: "selection_required"; candidates: string[] };

export async function resolveSiteUrl(
  targetUrl: string,
  selectedSiteUrl?: string,
): Promise<SiteResolution> {
  const res = await fetch(`${GATEWAY}/webmasters/v3/sites`, { headers: headers() });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kunde inte hämta Search Console-egenskaper [${res.status}]: ${body}`);
  }
  const { siteEntry = [] } = (await res.json()) as { siteEntry?: SiteEntry[] };
  const target = new URL(targetUrl);
  const matches = siteEntry.filter(
    (e) => e.permissionLevel !== "siteUnverifiedUser" && coversTarget(e.siteUrl, target),
  );
  if (selectedSiteUrl) {
    const found = matches.find((e) => e.siteUrl === selectedSiteUrl);
    if (!found) throw new Error("Vald Search Console-egenskap är inte verifierad för denna webbplats");
    return { status: "selected", siteUrl: found.siteUrl };
  }
  if (matches.length === 0) throw new Error("Ingen verifierad Search Console-egenskap täcker roslagstak.se");
  if (matches.length === 1) return { status: "selected", siteUrl: matches[0]!.siteUrl };
  return { status: "selection_required", candidates: matches.map((e) => e.siteUrl) };
}

export async function searchAnalytics(siteUrl: string, query: Record<string, unknown>) {
  const res = await fetch(
    `${GATEWAY}/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify(query),
    },
  );
  if (res.status === 403) {
    throw new Error("Det anslutna Google-kontot saknar åtkomst till egenskapen");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Search Console-anropet misslyckades [${res.status}]: ${body}`);
  }
  return (await res.json()) as {
    rows?: { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }[];
  };
}

export async function inspectUrl(siteUrl: string, inspectionUrl: string) {
  const res = await fetch(`${GATEWAY}/v1/urlInspection/index:inspect`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ inspectionUrl, siteUrl }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`URL-inspektionen misslyckades [${res.status}]: ${body}`);
  }
  return (await res.json()) as {
    inspectionResult?: {
      indexStatusResult?: {
        verdict?: string;
        coverageState?: string;
        robotsTxtState?: string;
        indexingState?: string;
        lastCrawlTime?: string;
        googleCanonical?: string;
        userCanonical?: string;
        pageFetchState?: string;
      };
      mobileUsabilityResult?: { verdict?: string };
    };
  };
}
