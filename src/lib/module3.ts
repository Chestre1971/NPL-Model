/**
 * Module 3 resolution strategy calculations.
 *
 * A Loans → Sub-portfolio sale at effective yield (T+1 quarter = period index 3)
 * B Loans → Cure payment at T+1Q, then re-performing sale at T+3Q (period index 9)
 * C Loans → DPO at T+12mo (period index 12) — discounted using 15% (interest) / 10% (principal)
 * D Loans → Non-judicial: T+18mo recovery; Judicial: T+36mo recovery (dynamic from acquisition date)
 */
import type { Loan } from '../data/loanTape';
import { parseDate, isIPD, fmtMonthYear, lastDayOfMonth, quarterDayCountFraction } from './dateUtils';

export interface M3Period {
  periodIdx: number;
  eop: Date;
  label: string;
  isIPD: boolean;
  // A loans
  aInterest: number;
  aPrincipal: number;
  aSaleProceeds: number;    // proceeds from sub-portfolio sale
  // B loans
  bInterest: number;
  bPrincipal: number;       // includes cure payment at Q1
  bSaleProceeds: number;    // proceeds from re-performing sale
  // C loans
  cInterest: number;
  cPrincipal: number;
  cDPOProceeds: number;
  // D loans
  dInterest: number;        // always 0 (payment default)
  dPrincipal: number;
  dForceCosts: number;      // negative
  dRecovery: number;        // enforcement recovery
  // Holding costs
  servicerFee: number;      // negative — quarterly servicer/AM fee on outstanding balance
  // Aggregates
  totalCash: number;
  netCashflow: number;
}

function repayPeriodIdxLocal(repayStr: string, timeline: Date[]): number {
  const repay = parseDate(repayStr);
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i] >= repay && isIPD(timeline[i])) return i;
  }
  return timeline.length - 1;
}

function quarterlyInterest(principal: number, coupon: number, ipdDate: Date): number {
  return principal * coupon * quarterDayCountFraction(ipdDate);
}

/**
 * A-Loan sub-portfolio sale:
 * Portfolios defined by LTV cutoffs: <=60%, <=65%, <=70%.
 * Priced at configurable effective yields by LTV bucket.
 * Sale at T+1Q (Jun 2026, period 3).
 */
export interface ASubPortfolio {
  label: string;
  ltvCutoff: number;
  yield: number;
  loans: Loan[];
  salePrice: number;
  saleProceeds: number;  // price + any T+1Q repayments (Jun 2026)
}

export function calcASubPortfolios(
  aLoans: Loan[],
  timeline: Date[],
  salePeriodIdx: number = 3, // T+1 quarter (Jun 2026)
  aYield60: number = 0.06,
  aYield65: number = 0.0625,
  aYield70: number = 0.0675,
): ASubPortfolio[] {
  const configs = [
    { label: 'Portfolio A (≤60% LTV)', ltvCutoff: 0.60, yield: aYield60 },
    { label: 'Portfolio B (≤65% LTV)', ltvCutoff: 0.65, yield: aYield65 },
    { label: 'Portfolio C (≤70% LTV)', ltvCutoff: 0.70, yield: aYield70 },
  ];

  return configs.map(cfg => {
    // Loans meeting the LTV cutoff AND not yet matured by sale date
    const eligible = aLoans.filter(l => l.ltv <= cfg.ltvCutoff);
    // Already repaid by T+1Q (Jun 2026) — these get repaid at par, not sold
    const repaidQ1 = eligible.filter(l => {
      const repayIdx = repayPeriodIdxLocal(l.repaymentDate || l.maturity, timeline);
      return repayIdx <= salePeriodIdx;
    });
    const forSale = eligible.filter(l => {
      const repayIdx = repayPeriodIdxLocal(l.repaymentDate || l.maturity, timeline);
      return repayIdx > salePeriodIdx;
    });

    // Sale price = PV of future cashflows at effective yield
    const monthlyYield = Math.pow(1 + cfg.yield, 1 / 12) - 1;
    let salePrice = 0;
    for (const loan of forSale) {
      const repayIdx = repayPeriodIdxLocal(loan.repaymentDate || loan.maturity, timeline);
      // Future cashflows relative to sale period
      for (let i = salePeriodIdx + 1; i <= repayIdx && i < timeline.length; i++) {
        if (isIPD(timeline[i])) {
          const periods = i - salePeriodIdx;
          salePrice += quarterlyInterest(loan.amount, loan.coupon, timeline[i]) / Math.pow(1 + monthlyYield, periods);
        }
      }
      // Principal at repay
      const repayPeriods = repayIdx - salePeriodIdx;
      salePrice += loan.amount / Math.pow(1 + monthlyYield, repayPeriods);
    }

    // T+1Q repayments (at par)
    const q1Repayments = repaidQ1.reduce((s, l) => s + l.amount + quarterlyInterest(l.amount, l.coupon, timeline[salePeriodIdx]), 0);

    return {
      label: cfg.label,
      ltvCutoff: cfg.ltvCutoff,
      yield: cfg.yield,
      loans: eligible,
      salePrice,
      saleProceeds: salePrice + q1Repayments,
    };
  });
}

/**
 * B-Loan cure payments.
 * All B loans cured at T+1Q (Jun 2026) via denominator cure (borrower pays down principal to reach 70% LTV).
 * Cure amount per loan = amount - (0.70 * collateralValue) [if positive, else 0].
 * After cure, re-performing sale at T+3Q (Dec 2026) at configurable effective yield.
 */
export interface BCureResult {
  totalCurePayments: number;
  postCureLoanBalance: number;
  rePerformingSalePrice: number;
  interestQ1: number;
  interestQ2: number;
  interestQ3: number;
}

export function calcBCure(
  bLoans: Loan[],
  timeline: Date[],
  _curePeriodIdx = 3,
  salePeriodIdx = 9,
  rePerformingSaleYield = 0.08,
): BCureResult {
  const n = timeline.length;
  const curePeriodIdx = Math.max(0, Math.min(_curePeriodIdx, n - 1));
  const q2PeriodIdx = Math.max(0, Math.min(curePeriodIdx + 3, n - 1));
  const safeSalePeriodIdx = Math.max(0, Math.min(salePeriodIdx, n - 1));

  let totalCure = 0;
  let postCureBalance = 0;
  let interestQ1 = 0, interestQ2 = 0, interestQ3 = 0;
  const monthlyYield = Math.pow(1 + rePerformingSaleYield, 1 / 12) - 1;
  let rePerformingSalePrice = 0;

  for (const loan of bLoans) {
    const cureAmount = Math.max(0, loan.amount - 0.70 * loan.collateralValue);
    const newPrincipal = loan.amount - cureAmount;
    totalCure += cureAmount;
    postCureBalance += newPrincipal;

    // Q1 interest (before cure, on original amount) — IPD at cure period.
    interestQ1 += quarterlyInterest(loan.amount, loan.coupon, timeline[curePeriodIdx]);
    // Q2 interest (after cure, on new principal) — next IPD (capped to timeline end).
    interestQ2 += quarterlyInterest(newPrincipal, loan.coupon, timeline[q2PeriodIdx]);
    // Q3 interest (used for valuation) — IPD at selected sale period (capped to timeline end).
    interestQ3 += quarterlyInterest(newPrincipal, loan.coupon, timeline[safeSalePeriodIdx]);

    // Re-performing sale price = PV of future CFs at selected sale period at 8% yield.
    const repayIdx = repayPeriodIdxLocal(loan.repaymentDate || loan.maturity, timeline);
    for (let i = safeSalePeriodIdx + 1; i <= repayIdx && i < n; i++) {
      if (isIPD(timeline[i])) {
        const periods = i - safeSalePeriodIdx;
        rePerformingSalePrice += quarterlyInterest(newPrincipal, loan.coupon, timeline[i]) / Math.pow(1 + monthlyYield, periods);
      }
    }
    const repayPeriods = repayIdx - safeSalePeriodIdx;
    rePerformingSalePrice += newPrincipal / Math.pow(1 + monthlyYield, repayPeriods);
  }

  return { totalCurePayments: totalCure, postCureLoanBalance: postCureBalance, rePerformingSalePrice, interestQ1, interestQ2, interestQ3 };
}

/**
 * C-Loan DPO (Discounted Payoff) pricing.
 * DPO occurs at T+12mo (Mar 2027, period 12).
 * Discount rates: 15% for interest income, 10% for principal prepayment.
 * Loans maturing before T+12mo simply repay at par.
 */
export interface CDPOResult {
  totalDPOProceeds: number;    // sum of DPO prices
  totalPreQ4Repayments: number; // loans repaying before DPO date
  periodicCash: number[];       // indexed by period
  periodicInterest: number[];   // contractual interest received through DPO/repay
  periodicPrincipal: number[];  // principal-equivalent receipts (par or DPO proceeds)
}

export function calcCDPO(
  cLoans: Loan[],
  timeline: Date[],
  dpoPeriodIdx = 12,
  dpoInterestDiscountRate = 0.15,
  dpoPrincipalDiscountRate = 0.10,
): CDPOResult {
  const n = timeline.length;
  const periodicCash = new Array(n).fill(0);
  const periodicInterest = new Array(n).fill(0);
  const periodicPrincipal = new Array(n).fill(0);
  let totalDPO = 0;
  let totalPreQ4 = 0;

  const monthlyRateInterest = Math.pow(1 + dpoInterestDiscountRate, 1 / 12) - 1;
  const monthlyRatePrincipal = Math.pow(1 + dpoPrincipalDiscountRate, 1 / 12) - 1;

  for (const loan of cLoans) {
    const repayIdx = repayPeriodIdxLocal(loan.repaymentDate || loan.maturity, timeline);

    // Contractual interest received up to min(repay, dpo date).
    for (let i = 1; i <= Math.min(repayIdx, dpoPeriodIdx) && i < n; i++) {
      if (!isIPD(timeline[i])) continue;
      periodicInterest[i] += quarterlyInterest(loan.amount, loan.coupon, timeline[i]);
    }

    if (repayIdx <= dpoPeriodIdx) {
      // Loan matures before or at DPO date — principal repays at par.
      periodicPrincipal[repayIdx] += loan.amount;
      totalPreQ4 += loan.amount;
    } else {
      // DPO pricing: PV of future interest + PV of principal at DPO date
      let dpoPrice = 0;
      for (let i = dpoPeriodIdx + 1; i <= repayIdx && i < n; i++) {
        if (isIPD(timeline[i])) {
          const periods = i - dpoPeriodIdx;
          dpoPrice += quarterlyInterest(loan.amount, loan.coupon, timeline[i]) / Math.pow(1 + monthlyRateInterest, periods);
        }
      }
      const principalPeriods = repayIdx - dpoPeriodIdx;
      dpoPrice += loan.amount / Math.pow(1 + monthlyRatePrincipal, principalPeriods);

      periodicPrincipal[dpoPeriodIdx] += dpoPrice;
      totalDPO += dpoPrice;
    }
  }

  for (let i = 0; i < n; i++) periodicCash[i] = periodicInterest[i] + periodicPrincipal[i];
  return { totalDPOProceeds: totalDPO, totalPreQ4Repayments: totalPreQ4, periodicCash, periodicInterest, periodicPrincipal };
}

/**
 * D-Loan enforcement.
 * Non-judicial (CA, NH): recovery at T+18mo from closing = Sep 30, 2027
 * Judicial (NY, PA): recovery at T+36mo from closing = Mar 31, 2029
 * Foreclosure costs = 5% of principal.
 * Recovery = enforcement recovery value from loan tape.
 * No interest (payment default).
 */
export interface DEnforcementResult {
  nonJudicialPeriodIdx: number;
  judicialPeriodIdx: number;
  nonJudicialRecovery: number;
  judicialRecovery: number;
  nonJudicialCosts: number;
  judicialCosts: number;
  totalNetRecovery: number;
  periodicCash: number[];
}

export function calcDEnforcement(
  dLoans: Loan[],
  timeline: Date[],
  njCostRate = 0.05,
  jCostRate = 0.05,
  njMonths = 18,
  jMonths = 36,
): DEnforcementResult {
  const n = timeline.length;
  const periodicCash = new Array(n).fill(0);

  // Derive enforcement dates dynamically from acquisition date (timeline[0]):
  //   Non-judicial: T + njMonths
  //   Judicial:     T + jMonths
  const acq = timeline[0];
  const acqY = acq.getUTCFullYear();
  const acqM = acq.getUTCMonth() + 1; // 1-indexed

  const totalNJ = acqY * 12 + (acqM - 1) + njMonths;
  const njDate = lastDayOfMonth(Math.floor(totalNJ / 12), totalNJ % 12 + 1);

  const totalJ = acqY * 12 + (acqM - 1) + jMonths;
  const jDate = lastDayOfMonth(Math.floor(totalJ / 12), totalJ % 12 + 1);

  const njIdx = timeline.findIndex(d => d >= njDate);
  const jIdx = timeline.findIndex(d => d >= jDate);
  const safenj = njIdx >= 0 ? njIdx : n - 1;
  const safej = jIdx >= 0 ? jIdx : n - 1;

  let njRecovery = 0, jRecovery = 0, njCosts = 0, jCosts = 0;

  for (const loan of dLoans) {
    const isJudicial = loan.judicial === 'J';
    const recovery = loan.enforcementRecovery; // collateral value from tape
    const costs = loan.amount * (isJudicial ? jCostRate : njCostRate);
    const netRecovery = recovery - costs;
    const periodIdx = isJudicial ? safej : safenj;

    periodicCash[periodIdx] += netRecovery;

    if (isJudicial) {
      jRecovery += recovery;
      jCosts += costs;
    } else {
      njRecovery += recovery;
      njCosts += costs;
    }
  }

  return {
    nonJudicialPeriodIdx: safenj,
    judicialPeriodIdx: safej,
    nonJudicialRecovery: njRecovery,
    judicialRecovery: jRecovery,
    nonJudicialCosts: njCosts,
    judicialCosts: jCosts,
    totalNetRecovery: njRecovery + jRecovery - njCosts - jCosts,
    periodicCash,
  };
}

/**
 * Build the full Module 3 combined cash flow.
 */
export function buildM3CashFlow(
  loans: Loan[],
  timeline: Date[],
  purchasePrice: number,
  legalDDRate: number = 0.005,
  aSalePeriodIdx: number = 3,
  bSalePeriodIdx: number = 9,
  dpoPeriodIdx: number = 12,
  njResolutionMonths: number = 18,
  jResolutionMonths: number = 36,
  njForceCostRate: number = 0.05,
  jForceCostRate: number = 0.05,
  servicerFeeRate: number = 0,
  dpoInterestDiscountRate: number = 0.15,
  dpoPrincipalDiscountRate: number = 0.10,
  aSaleYield60: number = 0.06,
  aSaleYield65: number = 0.0625,
  aSaleYield70: number = 0.0675,
  bReperformingSaleYield: number = 0.08,
): {
  periods: M3Period[];
  cashflows: number[];
  aSubPortfolios: ASubPortfolio[];
  bCure: BCureResult;
  cDPO: CDPOResult;
  dEnforcement: DEnforcementResult;
  totalServicerFees: number;
} {
  const n = timeline.length;
  const aLoans = loans.filter(l => l.riskFactor === 'A');
  const bLoans = loans.filter(l => l.riskFactor === 'B');
  const cLoans = loans.filter(l => l.riskFactor === 'C');
  const dLoans = loans.filter(l => l.riskFactor === 'D');

  const aSubPortfolios = calcASubPortfolios(aLoans, timeline, aSalePeriodIdx, aSaleYield60, aSaleYield65, aSaleYield70);
  const noBReperformingSale = bSalePeriodIdx >= n - 1;
  const bBalanceAtPar = bLoans.reduce((s, l) => s + l.amount, 0);
  const bCure = noBReperformingSale
    ? {
      totalCurePayments: 0,
      postCureLoanBalance: bBalanceAtPar,
      rePerformingSalePrice: 0,
      interestQ1: 0,
      interestQ2: 0,
      interestQ3: 0,
    }
    : calcBCure(bLoans, timeline, aSalePeriodIdx, bSalePeriodIdx, bReperformingSaleYield);
  const cDPO = calcCDPO(cLoans, timeline, dpoPeriodIdx, dpoInterestDiscountRate, dpoPrincipalDiscountRate);
  const dEnforcement = calcDEnforcement(
    dLoans,
    timeline,
    njForceCostRate,
    jForceCostRate,
    njResolutionMonths,
    jResolutionMonths,
  );

  // --- A Loans periodic cash ---
  const aInterestCash = new Array(n).fill(0);
  const aPrincipalCash = new Array(n).fill(0);
  // Use Portfolio C (most inclusive, ≤70% LTV) for the main CF — standard approach
  // A loans not in any sub-portfolio still pay interest and principal normally
  for (const loan of aLoans) {
    const repayIdx = repayPeriodIdxLocal(loan.repaymentDate || loan.maturity, timeline);
    for (let i = 1; i <= repayIdx && i < n; i++) {
      if (!isIPD(timeline[i])) continue;
      aInterestCash[i] += quarterlyInterest(loan.amount, loan.coupon, timeline[i]);
    }
    if (repayIdx < n) aPrincipalCash[repayIdx] += loan.amount;
  }
  // Add sale proceeds at aSalePeriodIdx (use largest portfolio C value)
  const bestPortfolio = aSubPortfolios[aSubPortfolios.length - 1]; // Portfolio C (≤70%)
  aPrincipalCash[aSalePeriodIdx] += bestPortfolio.salePrice;
  // Remove future interest/principal for sold loans (sold after T+1Q)
  const soldLoans = bestPortfolio.loans.filter(l =>
    repayPeriodIdxLocal(l.repaymentDate || l.maturity, timeline) > aSalePeriodIdx
  );
  for (const loan of soldLoans) {
    const repayIdx = repayPeriodIdxLocal(loan.repaymentDate || loan.maturity, timeline);
    for (let i = aSalePeriodIdx + 1; i <= repayIdx && i < n; i++) {
      if (isIPD(timeline[i])) aInterestCash[i] -= quarterlyInterest(loan.amount, loan.coupon, timeline[i]);
    }
    if (repayIdx < n) aPrincipalCash[repayIdx] -= loan.amount;
  }
  const aCash = aInterestCash.map((v, i) => v + aPrincipalCash[i]);

  // --- B Loans periodic cash ---
  const bInterestCash = new Array(n).fill(0);
  const bPrincipalCash = new Array(n).fill(0);
  if (noBReperformingSale) {
    // No re-performing sale at/beyond horizon: fall back to contractual B-loan cash flows.
    for (const loan of bLoans) {
      const repayIdx = repayPeriodIdxLocal(loan.repaymentDate || loan.maturity, timeline);
      for (let i = 1; i <= repayIdx && i < n; i++) {
        if (!isIPD(timeline[i])) continue;
        bInterestCash[i] += quarterlyInterest(loan.amount, loan.coupon, timeline[i]);
      }
      if (repayIdx < n) bPrincipalCash[repayIdx] += loan.amount;
    }
  } else {
    const safeASaleIdx = Math.max(0, Math.min(aSalePeriodIdx, n - 1));
    const safeBSaleIdx = Math.max(0, Math.min(bSalePeriodIdx, n - 1));
    // Q1: interest on original amount + cure payments received.
    bInterestCash[safeASaleIdx] += bCure.interestQ1;
    bPrincipalCash[safeASaleIdx] += bCure.totalCurePayments;
    // Q2: interest on post-cure balance.
    const q2Idx = Math.min(safeASaleIdx + 3, n - 1);
    bInterestCash[q2Idx] += bCure.interestQ2;
    // Sale date: interest + re-performing sale proceeds.
    bInterestCash[safeBSaleIdx] += bCure.interestQ3;
    bPrincipalCash[safeBSaleIdx] += bCure.rePerformingSalePrice;
  }
  const bCash = bInterestCash.map((v, i) => v + bPrincipalCash[i]);

  // --- C Loans periodic cash ---
  const cInterestCash = [...cDPO.periodicInterest];
  const cPrincipalCash = [...cDPO.periodicPrincipal];
  const cCash = cInterestCash.map((v, i) => v + cPrincipalCash[i]);

  // --- D Loans periodic cash ---
  const dCash = [...dEnforcement.periodicCash];

  // --- Servicer fee: quarterly drag on outstanding portfolio balance ---
  // Track BOP outstanding per period using resolution timings
  const outstanding = new Array(n).fill(0);
  for (const loan of aLoans) {
    const repayIdx = repayPeriodIdxLocal(loan.repaymentDate || loan.maturity, timeline);
    const exitIdx = Math.min(repayIdx, aSalePeriodIdx);
    for (let i = 0; i <= exitIdx && i < n; i++) outstanding[i] += loan.amount;
  }
  for (const loan of bLoans) {
    const cureAmt = Math.max(0, loan.amount - 0.70 * loan.collateralValue);
    const newPrincipal = loan.amount - cureAmt;
    const repayIdx = repayPeriodIdxLocal(loan.repaymentDate || loan.maturity, timeline);
    const exitIdx = Math.min(repayIdx, bSalePeriodIdx);
    for (let i = 0; i <= exitIdx && i < n; i++) {
      outstanding[i] += i <= aSalePeriodIdx ? loan.amount : newPrincipal;
    }
  }
  for (const loan of cLoans) {
    const repayIdx = repayPeriodIdxLocal(loan.repaymentDate || loan.maturity, timeline);
    const exitIdx = Math.min(repayIdx, dpoPeriodIdx);
    for (let i = 0; i <= exitIdx && i < n; i++) outstanding[i] += loan.amount;
  }
  for (const loan of dLoans) {
    const exitIdx = loan.judicial === 'J'
      ? dEnforcement.judicialPeriodIdx
      : dEnforcement.nonJudicialPeriodIdx;
    for (let i = 0; i <= exitIdx && i < n; i++) outstanding[i] += loan.amount;
  }

  let totalServicerFees = 0;
  const servicerCash = new Array(n).fill(0);
  if (servicerFeeRate > 0) {
    for (let i = 1; i < n; i++) {
      if (isIPD(timeline[i])) {
        const fee = outstanding[i] * servicerFeeRate * quarterDayCountFraction(timeline[i]);
        servicerCash[i] = -fee;
        totalServicerFees += fee;
      }
    }
  }

  // Build combined periods
  const periods: M3Period[] = timeline.map((eop, i) => {
    const grossCash = aCash[i] + bCash[i] + cCash[i] + dCash[i];
    const totalCash = grossCash + servicerCash[i];
    const legalDD = i === 0 ? purchasePrice * legalDDRate : 0;
    const netCF = i === 0 ? -(purchasePrice + legalDD) : totalCash;

    return {
      periodIdx: i,
      eop,
      label: fmtMonthYear(eop),
      isIPD: isIPD(eop),
      aInterest: aInterestCash[i],
      aPrincipal: aPrincipalCash[i],
      aSaleProceeds: 0,
      bInterest: bInterestCash[i],
      bPrincipal: bPrincipalCash[i],
      bSaleProceeds: 0,
      cInterest: cInterestCash[i],
      cPrincipal: cPrincipalCash[i],
      cDPOProceeds: 0,
      dInterest: 0,
      dPrincipal: dCash[i],
      dForceCosts: 0,
      dRecovery: 0,
      servicerFee: servicerCash[i],
      totalCash,
      netCashflow: netCF,
    };
  });

  const cashflows = periods.map(p => p.netCashflow);
  return { periods, cashflows, aSubPortfolios, bCure, cDPO, dEnforcement, totalServicerFees };
}
