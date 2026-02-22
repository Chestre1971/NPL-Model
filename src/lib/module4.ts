/**
 * Module 4: Loan-on-Loan (LoL) financing overlay.
 *
 * Term: 5 years
 * Loan Amount: 65% of APP (Allocated Purchase Price), pro-rated on lower of loan amount or collateral value.
 * Interest: 6.5% p.a. quarterly on outstanding LoL balance at quarter end.
 * Release pricing: 70% of APP per loan when proceeds received.
 * Prepayment penalty: 1% on principal repaid within first 12 months.
 * Arrangement fee: 1.25% total (50bps upfront, 75bps on full repayment).
 * Legal/DD: $1.5m shared costs.
 */
import type { Loan } from '../data/loanTape';
import { isIPD, fmtMonthYear, quarterDayCountFraction } from './dateUtils';

export interface LolParams {
  advanceRate: number;             // e.g. 0.65
  releaseRate: number;             // e.g. 0.70
  interestRate: number;            // e.g. 0.065
  prepayPenaltyRate: number;       // e.g. 0.01
  arrangementFeeUpfront: number;   // e.g. 0.005
  arrangementFeeTail: number;      // e.g. 0.0075
  legalDD: number;                 // e.g. 1_500_000 (dollars)
  upfrontCapitalised?: boolean;    // true = add upfront fee to LoL balance; false (default) = paid from equity on day 1
}

export const DEFAULT_LOL_PARAMS: LolParams = {
  advanceRate: 0.65,
  releaseRate: 0.70,
  interestRate: 0.065,
  prepayPenaltyRate: 0.01,
  arrangementFeeUpfront: 0.005,
  arrangementFeeTail: 0.0075,
  legalDD: 1_500_000,
};

export interface M4Period {
  periodIdx: number;
  eop: Date;
  label: string;
  isIPD: boolean;
  // Equity CF from M3
  m3NetCashflow: number;
  // LoL debt service
  lolOutstandingBOP: number;
  lolOutstandingEOP: number;  // balance after repayments this period
  lolInterest: number;
  lolPrincipalRepaid: number;
  lolPrepayPenalty: number;
  lolTailFee: number;       // tail arrangement fee paid on full repayment (0 for all other periods)
  // Net levered equity CF
  leveredEquityCF: number;
}

export interface LoLSummary {
  initialLoanAmount: number;
  upfrontFee: number;
  upfrontCapitalised: boolean;
  legalDD: number;
  totalInitialCost: number;
  totalInterestPaid: number;
  totalPrepayPenalties: number;
  tailFee: number;
}

export function buildM4CashFlow(
  loans: Loan[],
  m3Cashflows: number[], // net CF per period from M3 (period 0 = purchase date)
  timeline: Date[],
  purchasePrice: number,
  lolParams: LolParams = DEFAULT_LOL_PARAMS,
  acquisitionLegalDDRate: number = 0,
): {
  periods: M4Period[];
  cashflows: number[];
  summary: LoLSummary;
} {
  const { advanceRate, releaseRate, interestRate, prepayPenaltyRate,
          arrangementFeeUpfront, arrangementFeeTail, legalDD, upfrontCapitalised } = lolParams;

  const n = timeline.length;

  // APP per loan = pro-rata share based on lower of amount or collateralValue
  const appPerLoan = new Map<string, number>();
  for (const loan of loans) {
    const app = Math.min(loan.amount, loan.collateralValue);
    appPerLoan.set(loan.loanId, app);
  }

  // Initial LoL loan = advanceRate of total purchase price
  const initialLolAmount = purchasePrice * advanceRate;

  const upfrontFee = initialLolAmount * arrangementFeeUpfront;
  const acquisitionLegalDD = purchasePrice * acquisitionLegalDDRate;

  // If capitalised, fee is added to LoL balance and earns interest; otherwise paid by equity on day 1
  let lolOutstanding = upfrontCapitalised ? initialLolAmount + upfrontFee : initialLolAmount;
  const periods: M4Period[] = [];
  let totalInterest = 0, totalPrepay = 0;
  const firstTwelveMonths = 12; // periods 1-12 incur prepayment penalty

  for (let i = 0; i < n; i++) {
    const eop = timeline[i];
    const m3CF = m3Cashflows[i] ?? 0;

    if (i === 0) {
      // Purchase date: equity invests net of LoL funding; upfront fee either capitalised or paid current
      const equityIn = upfrontCapitalised
        ? -(purchasePrice - initialLolAmount + acquisitionLegalDD + legalDD)          // fee on LoL balance
        : -(purchasePrice - initialLolAmount + acquisitionLegalDD + upfrontFee + legalDD); // fee paid from equity
      periods.push({
        periodIdx: i, eop, label: fmtMonthYear(eop), isIPD: isIPD(eop),
        m3NetCashflow: m3CF,
        lolOutstandingBOP: 0,
        lolOutstandingEOP: lolOutstanding, // initial draw (+ upfront fee if capitalised)
        lolInterest: 0,
        lolPrincipalRepaid: 0,
        lolPrepayPenalty: 0,
        lolTailFee: 0,
        leveredEquityCF: equityIn,
      });
      continue;
    }

    const lolBOP = lolOutstanding;
    let lolInterest = 0;
    let lolPrincipalRepaid = 0;
    let prepayPenalty = 0;

    // Interest on LoL (quarterly, on outstanding balance) — Actual/365 day count
    if (isIPD(eop) && lolOutstanding > 0) {
      lolInterest = lolOutstanding * interestRate * quarterDayCountFraction(eop);
    }

    // Release: LoL repayment = releaseRate of any M3 inflow
    if (m3CF > 0 && lolOutstanding > 0) {
      lolPrincipalRepaid = Math.min(lolOutstanding, m3CF * releaseRate);
      if (i <= firstTwelveMonths) {
        prepayPenalty = lolPrincipalRepaid * prepayPenaltyRate;
      }
    }

    lolOutstanding = Math.max(0, lolOutstanding - lolPrincipalRepaid);
    totalInterest += lolInterest;
    totalPrepay += prepayPenalty;

    const leveredCF = m3CF - lolInterest - lolPrincipalRepaid - prepayPenalty;

    periods.push({
      periodIdx: i, eop, label: fmtMonthYear(eop), isIPD: isIPD(eop),
      m3NetCashflow: m3CF,
      lolOutstandingBOP: lolBOP,
      lolOutstandingEOP: lolOutstanding, // BOP − principal repaid this period
      lolInterest,
      lolPrincipalRepaid,
      lolPrepayPenalty: prepayPenalty,
      lolTailFee: 0,
      leveredEquityCF: leveredCF,
    });
  }

  // Tail fee on full repayment — due and payable in the period when LoL O/S first reaches zero
  const tailFee = initialLolAmount * arrangementFeeTail;
  const fullRepaymentPeriod = periods.find(p => p.lolOutstandingBOP > 0 && p.lolOutstandingEOP === 0);
  if (fullRepaymentPeriod) {
    fullRepaymentPeriod.leveredEquityCF -= tailFee;
    fullRepaymentPeriod.lolTailFee = tailFee;
  }

  const cashflows = periods.map(p => p.leveredEquityCF);

  const summary: LoLSummary = {
    initialLoanAmount: initialLolAmount,
    upfrontFee,
    upfrontCapitalised: upfrontCapitalised ?? false,
    legalDD,
    // If capitalised, upfront fee is on the LoL balance (not an equity day-1 cash cost)
    totalInitialCost: (upfrontCapitalised ? 0 : upfrontFee) + legalDD,
    totalInterestPaid: totalInterest,
    totalPrepayPenalties: totalPrepay,
    tailFee,
  };

  return { periods, cashflows, summary };
}
