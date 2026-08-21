/** Server-only hämtning av annonskostnad från Google Ads och Meta Ads. */

export type AdProvider = "google_ads" | "meta_ads";

export interface AdSpendRow {
  provider: AdProvider;
  account_id: string;
  campaign_id: string;
  campaign_name: string;
  spend_date: string;
  cost: number;
  impressions: number;
  clicks: number;
}

export function metaConfigured() {
  return Boolean(process.env["META_ADS_ACCESS_TOKEN"] && process.env["META_ADS_ACCOUNT_ID"]);
}

export function googleConfigured() {
  return Boolean(
    process.env["GOOGLE_ADS_DEVELOPER_TOKEN"] &&
      process.env["GOOGLE_ADS_CLIENT_ID"] &&
      process.env["GOOGLE_ADS_CLIENT_SECRET"] &&
      process.env["GOOGLE_ADS_REFRESH_TOKEN"] &&
      process.env["GOOGLE_ADS_CUSTOMER_ID"],
  );
}

/** Meta Marketing API – kostnad per kampanj och dag. */
export async function fetchMetaSpend(since: string, until: string): Promise<AdSpendRow[]> {
  const token = process.env["META_ADS_ACCESS_TOKEN"]!;
  const rawAccount = process.env["META_ADS_ACCOUNT_ID"]!.trim();
  const account = rawAccount.startsWith("act_") ? rawAccount : `act_${rawAccount}`;

  const url = new URL(`https://graph.facebook.com/v21.0/${account}/insights`);
  url.searchParams.set("level", "campaign");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("fields", "campaign_id,campaign_name,spend,impressions,clicks,date_start");
  url.searchParams.set("time_range", JSON.stringify({ since, until }));
  url.searchParams.set("limit", "500");
  url.searchParams.set("access_token", token);

  const rows: AdSpendRow[] = [];
  let next: string | null = url.toString();

  while (next) {
    const res: Response = await fetch(next);
    const body = (await res.json()) as {
      data?: Array<Record<string, string>>;
      paging?: { next?: string };
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new Error(`Meta Ads: ${body.error?.message ?? `HTTP ${res.status}`}`);
    }
    for (const r of body.data ?? []) {
      rows.push({
        provider: "meta_ads",
        account_id: account,
        campaign_id: r["campaign_id"] ?? "",
        campaign_name: r["campaign_name"] ?? "",
        spend_date: r["date_start"] ?? since,
        cost: Number(r["spend"] ?? 0),
        impressions: Number(r["impressions"] ?? 0),
        clicks: Number(r["clicks"] ?? 0),
      });
    }
    next = body.paging?.next ?? null;
  }

  return rows;
}

async function googleAccessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env["GOOGLE_ADS_CLIENT_ID"]!,
      client_secret: process.env["GOOGLE_ADS_CLIENT_SECRET"]!,
      refresh_token: process.env["GOOGLE_ADS_REFRESH_TOKEN"]!,
      grant_type: "refresh_token",
    }),
  });
  const body = (await res.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`Google Ads OAuth: ${body.error_description ?? body.error ?? `HTTP ${res.status}`}`);
  }
  return body.access_token;
}

/** Google Ads API – kostnad per kampanj och dag. */
export async function fetchGoogleSpend(since: string, until: string): Promise<AdSpendRow[]> {
  const customerId = process.env["GOOGLE_ADS_CUSTOMER_ID"]!.replace(/[^0-9]/g, "");
  const loginCustomerId = process.env["GOOGLE_ADS_LOGIN_CUSTOMER_ID"]?.replace(/[^0-9]/g, "");
  const accessToken = await googleAccessToken();

  const query = `
    SELECT campaign.id, campaign.name, segments.date, metrics.cost_micros,
           metrics.impressions, metrics.clicks
    FROM campaign
    WHERE segments.date BETWEEN '${since}' AND '${until}'
  `;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": process.env["GOOGLE_ADS_DEVELOPER_TOKEN"]!,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;

  const res = await fetch(`https://googleads.googleapis.com/v18/customers/${customerId}/googleAds:searchStream`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Google Ads: HTTP ${res.status} ${text.slice(0, 300)}`);
  }

  const chunks = JSON.parse(text) as Array<{
    results?: Array<{
      campaign?: { id?: string; name?: string };
      segments?: { date?: string };
      metrics?: { costMicros?: string; impressions?: string; clicks?: string };
    }>;
  }>;

  const rows: AdSpendRow[] = [];
  for (const chunk of chunks) {
    for (const r of chunk.results ?? []) {
      rows.push({
        provider: "google_ads",
        account_id: customerId,
        campaign_id: r.campaign?.id ?? "",
        campaign_name: r.campaign?.name ?? "",
        spend_date: r.segments?.date ?? since,
        cost: Number(r.metrics?.costMicros ?? 0) / 1_000_000,
        impressions: Number(r.metrics?.impressions ?? 0),
        clicks: Number(r.metrics?.clicks ?? 0),
      });
    }
  }
  return rows;
}
