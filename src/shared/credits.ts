// Customer-facing credit (Cr) formatting. 1 USD of allowance displays as
// `displayPerUsd` Cr (VITE_CREDIT_DISPLAY_PER_USD, default 100). All
// arithmetic here is exact integer math — no floating-point scaling.

/**
 * Format an integer USD-micros amount as the compact Cr denomination.
 *
 * Examples (displayPerUsd 100): 5_000_000 → "500 Cr", 123_456 → "12.35 Cr",
 * 0 → "0 Cr". Rounds half-up to at most two fractional digits and trims
 * trailing fractional zeros.
 */
export function formatCr(usdMicros: number, displayPerUsd = 100): string {
  const negative = usdMicros < 0;
  const micros = Math.abs(Math.trunc(usdMicros));

  // Hundredths of Cr = micros × displayPerUsd / 10_000, rounded half-up.
  const hundredths = Math.floor((micros * displayPerUsd + 5_000) / 10_000);

  const units = Math.floor(hundredths / 100);
  const fraction = hundredths % 100;

  let decimals = '';
  if (fraction > 0) {
    decimals =
      fraction % 10 === 0
        ? `.${fraction / 10}`
        : `.${fraction.toString().padStart(2, '0')}`;
  }

  return `${negative ? '-' : ''}${units.toString()}${decimals} Cr`;
}
