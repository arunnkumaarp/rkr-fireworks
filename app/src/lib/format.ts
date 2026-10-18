const rupee = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatRupees(value: number | string) {
  return rupee.format(typeof value === 'string' ? Number(value) : value);
}

/** Money is handled in paise so totals of many lines don't drift. */
export function toPaise(value: string | number) {
  return Math.round(Number(value) * 100);
}
