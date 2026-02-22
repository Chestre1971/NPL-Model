/**
 * IRR solver using Newton-Raphson method.
 * cashflows[0] is the initial outflow (negative), remainder are inflows.
 */
export function solveIRR(cashflows: number[], guess = 0.1, maxIter = 1000, tol = 1e-8): number {
  let rate = guess;
  for (let i = 0; i < maxIter; i++) {
    let npv = 0;
    let dNpv = 0;
    for (let t = 0; t < cashflows.length; t++) {
      const denom = Math.pow(1 + rate, t);
      npv += cashflows[t] / denom;
      dNpv -= (t * cashflows[t]) / Math.pow(1 + rate, t + 1);
    }
    if (Math.abs(dNpv) < 1e-14) break;
    const newRate = rate - npv / dNpv;
    if (Math.abs(newRate - rate) < tol) return newRate;
    rate = newRate;
  }
  return rate;
}

/**
 * NPV calculation given periodic rate and cashflows array.
 * cashflows[0] is period 0 (now).
 */
export function calcNPV(rate: number, cashflows: number[]): number {
  return cashflows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);
}

/**
 * Solve for price (investment amount at t=0) that yields a target monthly IRR.
 * cashflows should NOT include the initial investment.
 * Returns the purchase price (positive number).
 */
export function solvePriceForIRR(
  targetAnnualIRR: number,
  cashflows: number[], // periodic cashflows (positive = inflow)
  periodsPerYear: number = 12, // monthly = 12
): number {
  const targetRate = Math.pow(1 + targetAnnualIRR, 1 / periodsPerYear) - 1;
  // Price = PV of future cashflows at target rate
  return cashflows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + targetRate, t + 1), 0);
}

/**
 * Convert a monthly IRR to an annual IRR.
 */
export function monthlyToAnnualIRR(monthlyRate: number): number {
  return Math.pow(1 + monthlyRate, 12) - 1;
}

/**
 * Annualise an IRR from a series of monthly cashflows.
 * cashflows[0] = initial outflow (negative).
 */
export function calcAnnualIRR(cashflows: number[]): number {
  const monthly = solveIRR(cashflows, 0.01 / 12);
  return monthlyToAnnualIRR(monthly);
}

/**
 * MoIC = total inflows / total outflows (absolute).
 * Matches Excel: -SUMIF(range,">0") / SUMIF(range,"<0")
 */
export function calcMoIC(cashflows: number[]): number {
  const outflows = cashflows.filter(cf => cf < 0).reduce((s, cf) => s + Math.abs(cf), 0);
  const inflows = cashflows.filter(cf => cf > 0).reduce((s, cf) => s + cf, 0);
  return outflows === 0 ? 0 : inflows / outflows;
}

/**
 * XIRR: IRR using actual day-count fractions — matches Excel XIRR exactly.
 * cashflows[0] must be negative (initial investment).
 * dates[i] is the actual calendar date of cashflows[i].
 * Solves: Σ CF[i] / (1+rate)^((dates[i] − dates[0]) / 365) = 0
 * Returns the annual rate directly (no further annualisation needed).
 */
export function xirr(
  cashflows: number[],
  dates: Date[],
  guess = 0.1,
  maxIter = 1000,
  tol = 1e-8,
): number {
  const d0 = dates[0].getTime();
  const MS_PER_YEAR = 365 * 24 * 3600 * 1000;
  let rate = guess;
  for (let iter = 0; iter < maxIter; iter++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashflows.length; t++) {
      const exp = (dates[t].getTime() - d0) / MS_PER_YEAR;
      const factor = Math.pow(1 + rate, exp);
      npv += cashflows[t] / factor;
      if (exp !== 0) {
        dnpv -= (exp * cashflows[t]) / ((1 + rate) * factor);
      }
    }
    if (Math.abs(dnpv) < 1e-14) break;
    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < tol) return newRate;
    rate = newRate;
  }
  return rate;
}

/**
 * Solve for the purchase price that yields a target XIRR.
 * futureCFs[i] falls on allDates[i+1]; allDates[0] is the purchase date.
 * Returns the price as a positive number.
 */
export function solvePriceForXIRR(
  targetAnnualIRR: number,
  futureCFs: number[],
  allDates: Date[],
): number {
  const d0 = allDates[0].getTime();
  const MS_PER_YEAR = 365 * 24 * 3600 * 1000;
  return futureCFs.reduce((sum, cf, i) => {
    const exp = (allDates[i + 1].getTime() - d0) / MS_PER_YEAR;
    return sum + cf / Math.pow(1 + targetAnnualIRR, exp);
  }, 0);
}
