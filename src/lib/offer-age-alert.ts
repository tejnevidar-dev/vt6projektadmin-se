// Ren logik för offertålderslarmet (ingen I/O): vilka utskickade offerter har väntat för länge
// på kundens svar, och vem (säljaren) ska notifieras internt. Ingen notis går till kunden.
// Stängningen av utestående offerter är ett krav för kassamålet (12 st v40-v42).

export const DEFAULT_OFFER_AGE_ALERT_DAYS = 7;

export interface StaleOfferInput {
  id: string;
  lead_id: string;
  status: string;
  sent_at: string | null;
}

export interface OfferLeadInfo {
  seller_id: string | null;
  name: string;
}

export interface StaleOfferAlert {
  offerId: string;
  leadId: string;
  sellerId: string;
  leadName: string;
  daysWaiting: number;
}

/**
 * Offerter med status 'skickad' som skickades för minst `alertDays` dagar sedan och har en
 * känd ansvarig säljare. Offerter utan sent_at, med annan status, eller utan seller_id på
 * leaden hoppas över (inget att larma på, eller ingen att larma).
 */
export function findStaleOffers(
  offers: StaleOfferInput[],
  leadInfo: Map<string, OfferLeadInfo>,
  alertDays: number,
  now: Date,
): StaleOfferAlert[] {
  const cutoff = now.getTime() - alertDays * 86400000;
  const out: StaleOfferAlert[] = [];
  for (const o of offers) {
    if (o.status !== "skickad" || !o.sent_at) continue;
    const sentMs = new Date(o.sent_at).getTime();
    if (sentMs > cutoff) continue;
    const lead = leadInfo.get(o.lead_id);
    if (!lead?.seller_id) continue;
    out.push({
      offerId: o.id,
      leadId: o.lead_id,
      sellerId: lead.seller_id,
      leadName: lead.name,
      daysWaiting: Math.floor((now.getTime() - sentMs) / 86400000),
    });
  }
  return out;
}
