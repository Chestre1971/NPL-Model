/**
 * Cash flow model engine.
 * Builds monthly period arrays for all modules.
 */
import type { Loan } from '../data/loanTape';
import { parseDate, lastDayOfMonth, isIPD, fmtMonthYear, quarterDayCountFraction } from './dateUtils';

/** One period in the cash flow model */
export interface CFPeriod {
  periodIdx: number;
  bop: Date;
  eop: Date;
  label: string;        // "Mar 2022"
  isIPD: boolean;
  month: number;        // 1-12
  // M1/M2 fields
  debtOutstandingBOP: number;
  interestPayment: number;
  principalRepayment: number;
  loanLosses: number;
  totalCashFromLoans: number;
  netCashflow: number;
  // For display
  cumulPrincipal: number;
  cumulPrincipalPlusInterest: number;
  outstandingPrincipal: number;
}

/** Summary KPIs */
export interface CFSummary {
  totalInterest: number;
  totalPrincipal: number;
  totalLosses: number;
  totalCash: number;
  purchasePrice: number;
  profit: number;
  irr: number;
  moic: number;
}

/** Generate the 52-period timeline (Mar 2026 → Jun 2030) — acquisition date Mar 31 2026 */
export function buildTimeline(): Date[] {
  const dates: Date[] = [];
  let y = 2026, m = 3;
  while (y < 2030 || (y === 2030 && m <= 6)) {
    dates.push(lastDayOfMonth(y, m));
    m++;
    if (m > 12) { m = 1; y++; }
    if (dates.length > 60) break; // safety
  }
  return dates;
}

/** Determine on which period index a loan repays (next quarter-end >= repaymentDate). */
function repayPeriodIdx(repaymentDateStr: string, timeline: Date[]): number {
  const repay = parseDate(repaymentDateStr);
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i] >= repay && isIPD(timeline[i])) return i;
  }
  return timeline.length - 1;
}

/** Quarterly interest using Actual/365 day count (days between adjacent IPDs). */
function quarterlyInterest(principal: number, coupon: number, ipdDate: Date): number {
  return principal * coupon * quarterDayCountFraction(ipdDate);
}

/**
 * Module 1 Cash Flow: all loans performing, full bullet repayment.
 * Returns one CFPeriod per timeline period.
 */
export function buildM1CashFlow(
  loans: Loan[],
  timeline: Date[],
  purchasePrice: number,
): { periods: CFPeriod[]; cashflows: number[] } {
  const n = timeline.length;
  const periods: CFPeriod[] = timeline.map((eop, i) => ({
    periodIdx: i,
    bop: i === 0 ? eop : timeline[i - 1],
    eop,
    label: fmtMonthYear(eop),
    isIPD: isIPD(eop),
    month: eop.getUTCMonth() + 1,
    debtOutstandingBOP: 0,
    interestPayment: 0,
    principalRepayment: 0,
    loanLosses: 0,
    totalCashFromLoans: 0,
    netCashflow: 0,
    cumulPrincipal: 0,
    cumulPrincipalPlusInterest: 0,
    outstandingPrincipal: 0,
  }));

  // For each loan, add interest and principal to the correct periods
  for (const loan of loans) {
    const repayIdx = repayPeriodIdx(loan.repaymentDate || loan.maturity, timeline);

    // Interest: paid each IPD while loan is outstanding (not yet repaid)
    for (let i = 1; i < n; i++) {
      if (!isIPD(timeline[i])) continue;
      if (i > repayIdx) break;
      // Loan is outstanding at this IPD
      const interest = quarterlyInterest(loan.amount, loan.coupon, timeline[i]);
      periods[i].interestPayment += interest;
    }

    // Principal: repaid at repayIdx
    if (repayIdx < n) {
      periods[repayIdx].principalRepayment += loan.amount;
    }
  }

  // Compute running totals
  const totalDebt = loans.reduce((s, l) => s + l.amount, 0);
  let cumulP = 0, cumulPI = 0, outstanding = totalDebt;

  for (let i = 0; i < n; i++) {
    periods[i].debtOutstandingBOP = outstanding;
    periods[i].totalCashFromLoans = periods[i].interestPayment + periods[i].principalRepayment;
    // net cashflow: period 0 = -purchasePrice, rest = cash received
    periods[i].netCashflow = i === 0 ? -purchasePrice : periods[i].totalCashFromLoans;

    cumulP += periods[i].principalRepayment;
    cumulPI += periods[i].totalCashFromLoans;
    periods[i].cumulPrincipal = cumulP;
    periods[i].cumulPrincipalPlusInterest = cumulPI;
    periods[i].outstandingPrincipal = outstanding;

    outstanding -= periods[i].principalRepayment;
  }

  const cashflows = periods.map(p => p.netCashflow);
  return { periods, cashflows };
}

/**
 * Module 2 Cash Flow: by sub-portfolio (A/B/C/D), with:
 * - D loans = payment default (no interest)
 * - Loan losses = max(0, principal - collateralValue) for all loans
 * - Recovery = min(principal, collateralValue)
 */
export interface M2SubPortfolio {
  riskFactor: string;
  periods: {
    interestPayment: number;
    principalRepayment: number;
    loanLosses: number;
  }[];
  totalInterest: number;
  totalPrincipal: number;
  totalLosses: number;
}

export function buildM2CashFlow(
  loans: Loan[],
  timeline: Date[],
  purchasePrice: number,
  legalDDRate: number = 0.005,
  servicerFeeRate: number = 0,
): {
  subPortfolios: M2SubPortfolio[];
  periods: CFPeriod[];
  cashflows: number[];
} {
  const n = timeline.length;
  const riskFactors = ['A', 'B', 'C', 'D'];

  const subPortfolios: M2SubPortfolio[] = riskFactors.map(rf => ({
    riskFactor: rf,
    periods: Array.from({ length: n }, () => ({ interestPayment: 0, principalRepayment: 0, loanLosses: 0 })),
    totalInterest: 0,
    totalPrincipal: 0,
    totalLosses: 0,
  }));

  for (const loan of loans) {
    const rfIdx = riskFactors.indexOf(loan.riskFactor);
    if (rfIdx === -1) continue;
    const sp = subPortfolios[rfIdx];
    const repayIdx = repayPeriodIdx(loan.repaymentDate || loan.maturity, timeline);
    const isDefault = loan.ltv > 1.0; // D loans (>100% LTV)
    const loanLoss = Math.max(0, loan.amount - loan.collateralValue);

    // Interest: only if not in default
    if (!isDefault) {
      for (let i = 1; i < n; i++) {
        if (!isIPD(timeline[i])) continue;
        if (i > repayIdx) break;
        sp.periods[i].interestPayment += quarterlyInterest(loan.amount, loan.coupon, timeline[i]);
      }
    }

    // Principal at repay date (full amount)
    if (repayIdx < n) {
      sp.periods[repayIdx].principalRepayment += loan.amount;
      if (loanLoss > 0) {
        sp.periods[repayIdx].loanLosses -= loanLoss; // negative = loss
      }
    }
  }

  // Aggregate into combined periods
  const periods: CFPeriod[] = timeline.map((eop, i) => {
    const combined = subPortfolios.reduce(
      (acc, sp) => ({
        interest: acc.interest + sp.periods[i].interestPayment,
        principal: acc.principal + sp.periods[i].principalRepayment,
        losses: acc.losses + sp.periods[i].loanLosses,
      }),
      { interest: 0, principal: 0, losses: 0 }
    );

    return {
      periodIdx: i,
      bop: i === 0 ? eop : timeline[i - 1],
      eop,
      label: fmtMonthYear(eop),
      isIPD: isIPD(eop),
      month: eop.getUTCMonth() + 1,
      debtOutstandingBOP: 0,
      interestPayment: combined.interest,
      principalRepayment: combined.principal,
      loanLosses: combined.losses,
      totalCashFromLoans: combined.interest + combined.principal + combined.losses,
      netCashflow: 0,
      cumulPrincipal: 0,
      cumulPrincipalPlusInterest: 0,
      outstandingPrincipal: 0,
    };
  });

  const legalDD = purchasePrice * legalDDRate;
  let outstanding = loans.reduce((s, l) => s + l.amount, 0);
  let cumulP = 0, cumulPI = 0, cumulLoss = 0;

  for (let i = 0; i < n; i++) {
    periods[i].debtOutstandingBOP = outstanding;
    const servicerFee = (i > 0 && isIPD(timeline[i]))
      ? outstanding * servicerFeeRate * quarterDayCountFraction(timeline[i])
      : 0;
    const netCF = i === 0
      ? -(purchasePrice + legalDD)
      : periods[i].totalCashFromLoans - servicerFee;
    periods[i].netCashflow = netCF;

    cumulP += periods[i].principalRepayment + periods[i].loanLosses;
    cumulPI += periods[i].totalCashFromLoans;
    cumulLoss += Math.abs(periods[i].loanLosses);
    periods[i].cumulPrincipal = cumulP;
    periods[i].cumulPrincipalPlusInterest = cumulPI;
    periods[i].outstandingPrincipal = outstanding;

    outstanding -= periods[i].principalRepayment;
  }

  // Update sub-portfolio totals
  for (const sp of subPortfolios) {
    sp.totalInterest = sp.periods.reduce((s, p) => s + p.interestPayment, 0);
    sp.totalPrincipal = sp.periods.reduce((s, p) => s + p.principalRepayment, 0);
    sp.totalLosses = sp.periods.reduce((s, p) => s + p.loanLosses, 0);
  }

  const cashflows = periods.map(p => p.netCashflow);
  return { subPortfolios, periods, cashflows };
}

/**
 * Recovery Analysis Cash Flow: identical mechanics to M2 but uses FORECAST collateral
 * at each loan's maturity date instead of static current appraisal values.
 *
 * forecast_collateral = loan.collateralValue × (1 + bucketRate + stateRate)^yearsToMaturity
 * recovery            = min(loan.amount, forecast_collateral)
 * loan_loss           = loan.amount − recovery  (≥ 0)
 *
 * D loans (>100% LTV) remain in payment default — no interest collected.
 */
export function buildRecoveryCashFlow(
  loans: Loan[],
  timeline: Date[],
  purchasePrice: number,
  legalDDRate: number = 0.005,
  bucketRates: { A: number; B: number; C: number; D: number } = { A: 0, B: 0, C: 0, D: 0 },
  stateRates: Record<string, number> = {},
  servicerFeeRate: number = 0,
): {
  subPortfolios: M2SubPortfolio[];
  periods: CFPeriod[];
  cashflows: number[];
} {
  const n = timeline.length;
  const closingDate = timeline[0]; // Mar 31 2026
  const riskFactors = ['A', 'B', 'C', 'D'];

  const subPortfolios: M2SubPortfolio[] = riskFactors.map(rf => ({
    riskFactor: rf,
    periods: Array.from({ length: n }, () => ({ interestPayment: 0, principalRepayment: 0, loanLosses: 0 })),
    totalInterest: 0,
    totalPrincipal: 0,
    totalLosses: 0,
  }));

  for (const loan of loans) {
    const rfIdx = riskFactors.indexOf(loan.riskFactor);
    if (rfIdx === -1) continue;
    const sp = subPortfolios[rfIdx];
    const repayIdx = repayPeriodIdx(loan.repaymentDate || loan.maturity, timeline);
    const isDefault = loan.ltv > 1.0; // D loans in payment default

    // Forecast collateral at maturity
    const maturityDate = timeline[repayIdx];
    const yearsToMaturity = (maturityDate.getTime() - closingDate.getTime()) / (365.25 * 24 * 3600 * 1000);
    const annualRate =
      (bucketRates[loan.riskFactor as 'A' | 'B' | 'C' | 'D'] ?? 0) +
      (stateRates[loan.jurisdiction] ?? 0);
    const forecastCollateral = loan.collateralValue * Math.pow(1 + annualRate, yearsToMaturity);
    const recoveryAtMaturity = Math.min(loan.amount, forecastCollateral);
    const loanLoss = loan.amount - recoveryAtMaturity; // ≥ 0

    // Interest: only non-defaulted loans pay interest
    if (!isDefault) {
      for (let i = 1; i < n; i++) {
        if (!isIPD(timeline[i])) continue;
        if (i > repayIdx) break;
        sp.periods[i].interestPayment += quarterlyInterest(loan.amount, loan.coupon, timeline[i]);
      }
    }

    // Principal at repay date (full book amount); loss offset applied separately
    if (repayIdx < n) {
      sp.periods[repayIdx].principalRepayment += loan.amount;
      if (loanLoss > 0) {
        sp.periods[repayIdx].loanLosses -= loanLoss; // negative = cash outflow / write-off
      }
    }
  }

  // Aggregate sub-portfolios into combined period array
  const periods: CFPeriod[] = timeline.map((eop, i) => {
    const combined = subPortfolios.reduce(
      (acc, sp) => ({
        interest: acc.interest + sp.periods[i].interestPayment,
        principal: acc.principal + sp.periods[i].principalRepayment,
        losses: acc.losses + sp.periods[i].loanLosses,
      }),
      { interest: 0, principal: 0, losses: 0 }
    );
    return {
      periodIdx: i,
      bop: i === 0 ? eop : timeline[i - 1],
      eop,
      label: fmtMonthYear(eop),
      isIPD: isIPD(eop),
      month: eop.getUTCMonth() + 1,
      debtOutstandingBOP: 0,
      interestPayment: combined.interest,
      principalRepayment: combined.principal,
      loanLosses: combined.losses,
      totalCashFromLoans: combined.interest + combined.principal + combined.losses,
      netCashflow: 0,
      cumulPrincipal: 0,
      cumulPrincipalPlusInterest: 0,
      outstandingPrincipal: 0,
    };
  });

  const legalDD = purchasePrice * legalDDRate;
  let outstanding = loans.reduce((s, l) => s + l.amount, 0);
  let cumulP = 0, cumulPI = 0;

  for (let i = 0; i < n; i++) {
    periods[i].debtOutstandingBOP = outstanding;
    const servicerFee = (i > 0 && isIPD(timeline[i]))
      ? outstanding * servicerFeeRate * quarterDayCountFraction(timeline[i])
      : 0;
    const netCF = i === 0
      ? -(purchasePrice + legalDD)
      : periods[i].totalCashFromLoans - servicerFee;
    periods[i].netCashflow = netCF;

    cumulP += periods[i].principalRepayment + periods[i].loanLosses;
    cumulPI += periods[i].totalCashFromLoans;
    periods[i].cumulPrincipal = cumulP;
    periods[i].cumulPrincipalPlusInterest = cumulPI;
    periods[i].outstandingPrincipal = outstanding;
    outstanding -= periods[i].principalRepayment;
  }

  for (const sp of subPortfolios) {
    sp.totalInterest = sp.periods.reduce((s, p) => s + p.interestPayment, 0);
    sp.totalPrincipal = sp.periods.reduce((s, p) => s + p.principalRepayment, 0);
    sp.totalLosses = sp.periods.reduce((s, p) => s + p.loanLosses, 0);
  }

  const cashflows = periods.map(p => p.netCashflow);
  return { subPortfolios, periods, cashflows };
}
