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

/** Short rupees for charts and tight cells: ₹950, ₹12.4K, ₹3.2L, ₹1.1Cr. */
export function formatRupeesShort(value: number | string) {
  const n = Number(value);
  const abs = Math.abs(n);
  const [div, suffix] = abs >= 1e7 ? [1e7, 'Cr'] : abs >= 1e5 ? [1e5, 'L'] : abs >= 1e3 ? [1e3, 'K'] : [1, ''];
  const v = n / div;
  return `${n < 0 ? '−' : ''}₹${Math.abs(v).toFixed(div === 1 || Math.abs(v) >= 100 ? 0 : 1).replace(/\.0$/, '')}${suffix}`;
}

/** Whole rupees, for headline figures. */
export function formatRupeesWhole(value: number | string) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value));
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const d = value.length === 10 ? new Date(`${value}T00:00:00`) : new Date(value);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** Local calendar date as YYYY-MM-DD (not UTC, which is a day behind before 5:30 am in India). */
export function isoDate(d: Date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
