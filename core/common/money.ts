/** All money in the app is stored as integer cents to avoid float drift. */
export type Cents = number;

const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatMoney(cents: Cents): string {
  // Whole dollars render without ".00", fractional ones keep cents.
  const amount = cents / 100;
  if (Number.isInteger(amount)) {
    return formatter.format(amount).replace(/\.00$/, '');
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function dollars(amount: number): Cents {
  return Math.round(amount * 100);
}
