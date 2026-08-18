/**
 * Google Analytics 4 (server-only).
 * Datakällan är ännu inte ansluten – panelen visar "Datakälla ej ansluten"
 * tills en GA4-anslutning finns. Strukturen nedan är förberedd så att endast
 * runReport() behöver implementeras när anslutningen är på plats.
 */

export type Ga4Status = { connected: false; reason: string } | { connected: true; propertyId: string };

export function ga4Status(): Ga4Status {
  const propertyId = process.env["GA4_PROPERTY_ID"];
  const gateway = process.env["GOOGLE_ANALYTICS_API_KEY"];
  if (!propertyId || !gateway) {
    return {
      connected: false,
      reason: "Google Analytics 4 är inte anslutet. Anslut GA4 och ange GA4_PROPERTY_ID för att visa organiska användare, sessioner och konverteringar.",
    };
  }
  return { connected: true, propertyId };
}

export type Ga4Organic = {
  users: number;
  sessions: number;
  conversions: number;
  engagementRate: number | null;
};

export async function runOrganicReport(_startDate: string, _endDate: string): Promise<Ga4Organic> {
  const status = ga4Status();
  if (!status.connected) throw new Error(status.reason);
  const res = await fetch(
    `https://connector-gateway.lovable.dev/google_analytics/v1beta/properties/${status.propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
        "X-Connection-Api-Key": process.env["GOOGLE_ANALYTICS_API_KEY"]!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: _startDate, endDate: _endDate }],
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "totalUsers" }, { name: "sessions" }, { name: "conversions" }, { name: "engagementRate" }],
      }),
    },
  );
  if (!res.ok) throw new Error(`GA4-anropet misslyckades [${res.status}]: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as any;
  const row = (json.rows ?? []).find((r: any) => /organic/i.test(r.dimensionValues?.[0]?.value ?? ""));
  const num = (i: number) => Number(row?.metricValues?.[i]?.value ?? 0);
  return { users: num(0), sessions: num(1), conversions: num(2), engagementRate: row ? num(3) : null };
}
