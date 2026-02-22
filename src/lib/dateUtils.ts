/**
 * Date utilities for the NPL model.
 * All dates as ISO strings (YYYY-MM-DD). Period = 1 month.
 */

/** Parse ISO date string to Date object (UTC noon to avoid DST issues). */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** Return last day of month for a given year/month (1-indexed). */
export function lastDayOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0, 12)); // day 0 of next month = last day of current
}

/** Format date as YYYY-MM-DD */
export function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Format date as "Mar 2022" */
export function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Generate monthly period end dates (last day of each month) from Mar 2026 through Jun 2030.
 * Period 0 = 2026-03-31 (purchase date / T=0).
 */
export function generatePeriodDates(): Date[] {
  const dates: Date[] = [];
  // Start: Mar 2026
  let year = 2026, month = 3;
  while (year < 2030 || (year === 2030 && month <= 6)) {
    dates.push(lastDayOfMonth(year, month));
    month++;
    if (month > 12) { month = 1; year++; }
  }
  return dates;
}

/** Is a date an Interest Payment Date (quarter end: Mar, Jun, Sep, Dec)? */
export function isIPD(d: Date): boolean {
  const m = d.getUTCMonth() + 1;
  return m === 3 || m === 6 || m === 9 || m === 12;
}

/** Days in a month for a given period-end date. */
export function daysInPeriod(eop: Date): number {
  // Days from first of same month to last day = days in month
  const m = eop.getUTCMonth();
  const y = eop.getUTCFullYear();
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

/** Days between two dates. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Actual/365 day count fraction for a quarterly interest period.
 * Computes actual days between the previous quarter-end IPD and this IPD.
 * Quarter lengths: Mar=90 (91 leap), Jun=91, Sep=92, Dec=92 days.
 * Max error vs. fixed 91.25/365 ≈ 1.37% (Mar quarter) — exceeds 0.1% threshold.
 */
export function quarterDayCountFraction(periodEndDate: Date): number {
  const m = periodEndDate.getUTCMonth() + 1; // 1-12
  const y = periodEndDate.getUTCFullYear();
  let prevM: number, prevY: number;
  if (m === 3)      { prevM = 12; prevY = y - 1; }
  else if (m === 6) { prevM = 3;  prevY = y; }
  else if (m === 9) { prevM = 6;  prevY = y; }
  else              { prevM = 9;  prevY = y; } // m === 12
  return daysBetween(lastDayOfMonth(prevY, prevM), periodEndDate) / 365;
}

/** Which quarter-end date does a maturity date fall into? (loan repays on next IPD >= maturity) */
export function nextIPD(maturityStr: string): Date {
  const mat = parseDate(maturityStr);
  const y = mat.getUTCFullYear();
  // Quarter ends: 3, 6, 9, 12
  const quarterEnds = [3, 6, 9, 12];
  for (const qm of quarterEnds) {
    const qEnd = lastDayOfMonth(y, qm);
    if (qEnd >= mat) return qEnd;
  }
  // Next year Q1
  return lastDayOfMonth(y + 1, 3);
}
