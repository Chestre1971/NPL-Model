/** Formatting utilities for numbers and dates. */

export const fmt = {
  currency: (n: number, decimals = 0) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n),

  currencyM: (n: number, decimals = 1) =>
    `$${(n / 1_000_000).toFixed(decimals)}m`,

  pct: (n: number, decimals = 2) =>
    `${(n * 100).toFixed(decimals)}%`,

  num: (n: number, decimals = 0) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n),

  date: (s: string) => {
    if (!s) return '—';
    const d = new Date(s + 'T12:00:00Z');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  },

  dateShort: (s: string) => {
    if (!s) return '—';
    const d = new Date(s + 'T12:00:00Z');
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
  },

  dateObj: (d: Date) => {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  },

  x: (n: number, decimals = 2) => `${n.toFixed(decimals)}x`,
};
