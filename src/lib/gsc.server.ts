// Auth: a Google Cloud service account (project "roslagstak-crm") added as a "Full"
// user directly in Search Console (Settings -> Users and permissions) for the
// sc-domain:roslagstak.se property. No OAuth2 consent flow / refresh token needed --
// we sign a JWT with the service account's private key and exchange it for an access
// token via Google's token endpoint, same as any server-to-server Google API call.

import { SignJWT, importPKCS8 } from "jose";

const GATEWAY = "https://www.googleapis.com";

export const TARGET_SITE = "https://roslagstak.se/";

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }
  const email = process.env.GSC_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GSC_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error("GSC_SERVICE_ACCOUNT_EMAIL/GSC_SERVICE_ACCOUNT_PRIVATE_KEY är inte konfigurerade.");
  }
  const privateKey = await importPKCS8(rawKey.replace(/\\n/g, "\n"), "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(email)
    .setSubject(email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Kunde inte hämta Google-åtkomsttoken [${res.status}]: ${body}`);
  }
  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { accessToken: access_token, expiresAt: Date.now() + expires_in * 1000 };
  return access_token;
}

async function headers(): Promise<Record<string, string>> {
  return { Authorization: `Bearer ${await getAccessToken()}` };
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
  const res = await fetch(`${GATEWAY}/webmasters/v3/sites`, { headers: await headers() });
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
      headers: { ...(await headers()), "Content-Type": "application/json" },
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
  const res = await fetch(`https://searchconsole.googleapis.com/v1/urlInspection/index:inspect`, {
    method: "POST",
    headers: { ...(await headers()), "Content-Type": "application/json" },
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
