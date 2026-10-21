// USD rounds to the nearest cent, matching the storefront. PostgreSQL Int is the tighter bound.
export const MAX_CENTS = 2_147_483_647;

export function isValidCents(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_CENTS;
}

export function usdToCents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const cents = Math.round(value * 100);
  return isValidCents(cents) ? cents : null;
}
