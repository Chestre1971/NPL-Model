import { buildM3CashFlow } from '../../lib/module3';
import { buildM4CashFlow } from '../../lib/module4';
import { xirr, calcMoIC } from '../../lib/irr';
import type { SharedAssumptions } from '../../context/AppContext';
import type { Loan } from '../../data/loanTape';

export interface IRRResult {
  unlevered: number;
  levered: number;
  unleveredMoIC: number;
  leveredMoIC: number;
}

export function computeIRRs(
  effectiveLoans: Loan[],
  timeline: Date[],
  assumptions: SharedAssumptions,
  pp: number,
  njCost: number,
  jCost: number,
  dpoPeriodIdx?: number,
): IRRResult {
  const m3 = buildM3CashFlow(
    effectiveLoans, timeline, pp,
    assumptions.m2LegalDDRate,
    assumptions.m3ASalePeriodIdx,
    assumptions.m3BSalePeriodIdx,
    dpoPeriodIdx ?? assumptions.m3DPOPeriodIdx,
    assumptions.m4NJResolutionMonths,
    assumptions.m4JResolutionMonths,
    njCost, jCost,
    assumptions.m4ServicerFeeRate,
    assumptions.m3DPOInterestDiscountRate,
    assumptions.m3DPOPrincipalDiscountRate,
    assumptions.m3ASaleYield60,
    assumptions.m3ASaleYield65,
    assumptions.m3ASaleYield70,
    assumptions.m3BReperformingSaleYield,
  );
  const m4 = buildM4CashFlow(effectiveLoans, m3.cashflows, timeline, pp, {
    advanceRate:           assumptions.m5LolAdvanceRate,
    releaseRate:           assumptions.m5LolReleaseRate,
    interestRate:          assumptions.m5LolInterestRate,
    prepayPenaltyRate:     assumptions.m5LolPrepayPenaltyRate,
    arrangementFeeUpfront: assumptions.m5LolArrangementFeeUpfront,
    arrangementFeeTail:    assumptions.m5LolArrangementFeeTail,
    legalDD:               assumptions.m5LolLegalDD,
    upfrontCapitalised:    assumptions.m5LolUpfrontCapitalised !== 0,
  }, assumptions.m2LegalDDRate);
  return {
    unlevered:     xirr(m3.cashflows, timeline),
    levered:       xirr(m4.cashflows, timeline),
    unleveredMoIC: calcMoIC(m3.cashflows),
    leveredMoIC:   calcMoIC(m4.cashflows),
  };
}

export function cellColor(irr: number): string {
  if (irr >= 0.14) return 'text-green-700 bg-green-50 font-semibold';
  if (irr >= 0.12) return 'text-green-600';
  if (irr >= 0.09) return 'text-amber-600';
  return 'text-red-600';
}

export const PRICE_DELTAS = [-0.20, -0.10, -0.05, 0, 0.05, 0.10, 0.20] as const;

export const COST_CONFIGS = [
  { label: 'Low Costs\n5% NJ / 10% J',   nj: 0.05, j: 0.10 },
  { label: 'Base Costs\n10% NJ / 20% J', nj: 0.10, j: 0.20 },
  { label: 'High Costs\n15% NJ / 25% J', nj: 0.15, j: 0.25 },
] as const;
