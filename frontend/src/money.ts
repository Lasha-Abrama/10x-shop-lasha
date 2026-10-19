// USD prices round to the nearest cent. Every cent amount must be a nonnegative safe integer.
export function usdToCents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const cents = Math.round(value * 100);
  return centsToUsd(cents) !== null ? cents : null;
}

export function centsToUsd(cents: number): number | null {
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  const dollars = cents / 100;
  // Near the safe-integer limit, conversion to dollars can lose a displayed cent.
  const displayed = dollars.toLocaleString('en-US', {
    useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  return Number(displayed.replace('.', '')) === cents && Math.round(dollars * 100) === cents ? dollars : null;
}
