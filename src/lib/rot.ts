/**
 * Gemensam ROT-beräkning för hela systemet.
 * Samma formel används av offertmotorn (calc-engine) och kalkylen (quick-price):
 * ROT = arbetskostnad inkl. moms × ROT-procent, begränsat till taket per ägare.
 */

export const ROT_PERCENT_DEFAULT = 30;
export const ROT_CAP_PER_OWNER_DEFAULT = 50_000;

export interface RotParams {
  /** Arbetskostnad inklusive moms (ROT-grundande belopp). */
  laborInclVat: number;
  /** ROT-procent, t.ex. 30. */
  rotPercent?: number;
  /** Maximalt ROT-avdrag per ägare och år. */
  capPerOwner?: number;
  /** Antal ägare som kan nyttja avdraget. */
  owners?: number;
}

export function computeRot({
  laborInclVat,
  rotPercent = ROT_PERCENT_DEFAULT,
  capPerOwner = ROT_CAP_PER_OWNER_DEFAULT,
  owners = 1,
}: RotParams): number {
  if (!(laborInclVat > 0)) return 0;
  const raw = laborInclVat * (rotPercent / 100);
  const cap = capPerOwner * Math.max(1, owners);
  return Math.max(0, Math.min(raw, cap));
}
