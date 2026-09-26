// Ren logik för vad som händer med leaden när kunden signerat en offert.

const WON_OR_LATER = ["bokad", "pagaende", "slutford"];

/** Nytt pipeline-steg efter kundens signering, eller null om leaden redan är vunnen/pågående/slutförd. */
export function stageAfterSignature(current: string): "bokad" | null {
  return WON_OR_LATER.includes(current) ? null : "bokad";
}

/** Bara offerter (eller äldre begäran utan typ) räknas som accepterad offert. */
export function isOfferDocument(documentType: string | null | undefined): boolean {
  return documentType == null || documentType === "offert";
}
