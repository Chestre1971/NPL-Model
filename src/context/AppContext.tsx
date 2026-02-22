import React, { createContext, useContext, useReducer, useEffect, useState, useMemo } from 'react';
import { loadState, saveState, saveStudentRecord, type AppState, type LoanOverride } from '../lib/storage';
import type { Loan } from '../data/loanTape';
import { buildTimeline } from '../lib/cashflow';
import { calcMoIC, xirr, solvePriceForXIRR } from '../lib/irr';
import { buildM1CashFlow, buildM2CashFlow, buildRecoveryCashFlow } from '../lib/cashflow';
import { buildM3CashFlow } from '../lib/module3';
import { buildM4CashFlow } from '../lib/module4';
import { isJudicialState } from '../lib/states';

// ─── Shared Assumptions ────────────────────────────────────────────────────────

export interface SharedAssumptions {
  /** Module 2: purchase price (drives IRR → shared to M3 & M4) */
  m2PurchasePrice: number;
  /** Module 2: Legal DD rate */
  m2LegalDDRate: number;
  /** Module 3: A-loan sale period (period index, default 3 = Q1 2022) */
  m3ASalePeriodIdx: number;
  /** Module 3: B-loan re-performing sale period (default 9 = Q3 2022) */
  m3BSalePeriodIdx: number;
  /** Module 3: A-loan sale yields by LTV cutoff */
  m3ASaleYield60: number;
  m3ASaleYield65: number;
  m3ASaleYield70: number;
  /** Module 3: B-loan re-performing sale yield */
  m3BReperformingSaleYield: number;
  /** Module 3: C-loan DPO period (default 12 = Q4 2022) */
  m3DPOPeriodIdx: number;
  /** Module 3: DPO interest discount rate (default 15%) */
  m3DPOInterestDiscountRate: number;
  /** Module 3: DPO principal discount rate (default 10%) */
  m3DPOPrincipalDiscountRate: number;
  /** Module 1: target IRR for price calculation */
  m1TargetIRR: number;
  /** Module 4: D-loan non-judicial foreclosure cost rate (default 5%) */
  m4NJResolutionMonths: number;
  /** Module 4: D-loan judicial foreclosure timing in months from close */
  m4JResolutionMonths: number;
  /** Module 4: D-loan non-judicial foreclosure cost rate (default 5%) */
  m4NJForceCostRate: number;
  /** Module 4: D-loan judicial foreclosure cost rate (default 5%) */
  m4JForceCostRate: number;
  /** Module 4: annual servicer fee rate on outstanding portfolio balance (default 0) */
  m4ServicerFeeRate: number;
  /** Recovery Analysis: annual collateral appreciation rate per risk bucket */
  recoveryAppA: number;
  recoveryAppB: number;
  recoveryAppC: number;
  recoveryAppD: number;
  /** Recovery Analysis: per-state additional collateral appreciation adjustment */
  recoveryStateRates: Record<string, number>;
  /** Module 5: LoL facility terms */
  m5LolAdvanceRate: number;
  m5LolReleaseRate: number;
  m5LolInterestRate: number;
  m5LolPrepayPenaltyRate: number;
  m5LolArrangementFeeUpfront: number;
  m5LolArrangementFeeTail: number;
  m5LolLegalDD: number;
  /** 0 = upfront fee paid current from equity on day 1; 1 = capitalised to LoL balance */
  m5LolUpfrontCapitalised: number;
}

const DEFAULT_ASSUMPTIONS: SharedAssumptions = {
  m2PurchasePrice: 0, // placeholder — overridden by computed m1PriceAt12pct at runtime
  m2LegalDDRate: 0.005,
  m3ASalePeriodIdx: 3,
  m3BSalePeriodIdx: 9,
  m3ASaleYield60: 0.06,
  m3ASaleYield65: 0.0625,
  m3ASaleYield70: 0.0675,
  m3BReperformingSaleYield: 0.08,
  m3DPOPeriodIdx: 12,
  m3DPOInterestDiscountRate: 0.09,
  m3DPOPrincipalDiscountRate: 0.09,
  m1TargetIRR: 0.125,
  m4NJResolutionMonths: 18,
  m4JResolutionMonths: 36,
  m4NJForceCostRate: 0.08,  // market rate: ~8-12% for non-judicial
  m4JForceCostRate: 0.15,   // market rate: ~15-25% for judicial
  m4ServicerFeeRate: 0.005,
  recoveryAppA: 0,
  recoveryAppB: 0,
  recoveryAppC: 0,
  recoveryAppD: 0,
  recoveryStateRates: { California: 0.04, 'New Hampshire': 0.02, 'New York': 0.01, Pennsylvania: -0.05 },
  m5LolAdvanceRate: 0.65,
  m5LolReleaseRate: 0.70,
  m5LolInterestRate: 0.06,
  m5LolPrepayPenaltyRate: 0.01,
  m5LolArrangementFeeUpfront: 0.005,
  m5LolArrangementFeeTail: 0.00,
  m5LolLegalDD: 1_500_000,
  m5LolUpfrontCapitalised: 0,
};

// ─── State & Actions ───────────────────────────────────────────────────────────

type Action =
  | { type: 'LOGIN'; payload: { studentId: string; name: string } }
  | { type: 'LOGOUT' }
  | { type: 'SET_ANSWER'; module: keyof AppState['modules']; questionId: string; answer: string }
  | { type: 'SET_TEXT_ANSWER'; module: keyof AppState['modules']; questionId: string; answer: string }
  | { type: 'SET_ASSUMPTION'; key: keyof SharedAssumptions; value: number }
  | { type: 'SET_MODULE_ASSUMPTIONS'; module: keyof AppState['modules']; assumptions: Record<string, number> }
  | { type: 'MARK_COMPLETE'; module: keyof AppState['modules'] }
  | { type: 'OVERRIDE_LOAN'; loanId: string; changes: LoanOverride }
  | { type: 'RESET_LOAN'; loanId: string }
  | { type: 'RESET_ALL_LOANS' };

interface AppContextValue {
  state: AppState;
  assumptions: SharedAssumptions;
  dispatch: React.Dispatch<Action>;
  timeline: Date[];
  effectiveLoans: Loan[];
  // Computed models (memoized)
  m1CF: ReturnType<typeof buildM1CashFlow>;
  m2CF: ReturnType<typeof buildM2CashFlow>;
  m3CF: ReturnType<typeof buildM3CashFlow>;
  m4CF: ReturnType<typeof buildM4CashFlow>;
  recoveryCF: ReturnType<typeof buildRecoveryCashFlow>;
  // Summary metrics
  m1IRR: number; m1MoIC: number;
  m2IRR: number; m2MoIC: number;
  m3IRR: number; m3MoIC: number;
  m4IRR: number; m4MoIC: number;
  recoveryIRR: number; recoveryMoIC: number;
  // Computed prices for target IRR (no hardcodes)
  m1PriceAt12pct: number;
  m2PriceAt12pct: number;
  m3PriceAt12pct: number;
  recoveryPriceAt12pct: number;
}

const AppContext = createContext<AppContextValue | null>(null);

const EMPTY_MODULE = { completed: false, answers: {}, textAnswers: {}, assumptions: {} };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOGIN': {
      const now = new Date().toISOString();
      return {
        ...state,
        session: {
          studentId: action.payload.studentId,
          name: action.payload.name,
          startedAt: now,
          lastActive: now,
        },
      };
    }
    case 'LOGOUT':
      return { ...state, session: null };

    case 'SET_ANSWER': {
      const mod = state.modules[action.module] ?? EMPTY_MODULE;
      return {
        ...state,
        modules: {
          ...state.modules,
          [action.module]: { ...mod, answers: { ...mod.answers, [action.questionId]: action.answer } },
        },
      };
    }
    case 'SET_TEXT_ANSWER': {
      const mod = state.modules[action.module] ?? EMPTY_MODULE;
      return {
        ...state,
        modules: {
          ...state.modules,
          [action.module]: { ...mod, textAnswers: { ...mod.textAnswers, [action.questionId]: action.answer } },
        },
      };
    }
    case 'SET_MODULE_ASSUMPTIONS': {
      const mod = state.modules[action.module] ?? EMPTY_MODULE;
      return {
        ...state,
        modules: {
          ...state.modules,
          [action.module]: { ...mod, assumptions: { ...mod.assumptions, ...action.assumptions } },
        },
      };
    }
    case 'MARK_COMPLETE': {
      const mod = state.modules[action.module] ?? EMPTY_MODULE;
      return {
        ...state,
        modules: { ...state.modules, [action.module]: { ...mod, completed: true } },
      };
    }
    case 'OVERRIDE_LOAN': {
      return {
        ...state,
        loanOverrides: {
          ...state.loanOverrides,
          [action.loanId]: { ...(state.loanOverrides[action.loanId] ?? {}), ...action.changes },
        },
      };
    }
    case 'RESET_LOAN': {
      const next = { ...state.loanOverrides };
      delete next[action.loanId];
      return { ...state, loanOverrides: next };
    }
    case 'RESET_ALL_LOANS':
      return { ...state, loanOverrides: {} };
    default:
      return state;
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const [loanTape, setLoanTape] = useState<Loan[]>([]);

  // Lazy-load the 178 KB loan tape data chunk — keeps the initial bundle small.
  useEffect(() => {
    import('../data/loanTape').then(m => setLoanTape(m.LOAN_TAPE));
  }, []);

  const timeline = useMemo(() => buildTimeline(), []);

  // Merge loanTape with user overrides; recompute derived fields on change.
  // judicial is always derived from jurisdiction (state-based rule), not stored per-loan.
  const effectiveLoans = useMemo<Loan[]>(() => {
    const overrides = state.loanOverrides;
    return loanTape.map(loan => {
      const ov = overrides[loan.loanId];
      const merged: Loan = ov ? { ...loan, ...ov } : { ...loan };
      // Prefer tape-level judicial tagging when provided; fallback to state rule only if missing/unknown.
      if (merged.judicial === 'J') {
        merged.judicial = 'J';
      } else if (merged.judicial === 'NJ' || merged.judicial === '') {
        merged.judicial = '';
      } else {
        merged.judicial = isJudicialState(merged.jurisdiction) ? 'J' : '';
      }
      // Recompute LTV and risk bucket if collateral changed
      if (merged.collateralValue > 0) {
        merged.ltv = merged.amount / merged.collateralValue;
      }
      merged.riskFactor = merged.ltv <= 0.70 ? 'A' : merged.ltv <= 0.85 ? 'B' : merged.ltv <= 1.0 ? 'C' : 'D';
      return merged;
    });
  }, [loanTape, state.loanOverrides]);

  const parPrice = useMemo(() => {
    return effectiveLoans.reduce((s, l) => s + l.amount, 0);
  }, [effectiveLoans]);

  // Module 1 CF: performing baseline at par (needed before assumptions to compute target price)
  const m1CF = useMemo(() => {
    return buildM1CashFlow(effectiveLoans, timeline, parPrice);
  }, [effectiveLoans, timeline, parPrice]);

  // Price at which M1 cashflows yield exactly 12.5% XIRR — drives default purchase price
  const m1PriceAt12pct = useMemo(() => {
    return solvePriceForXIRR(0.125, m1CF.cashflows.slice(1), timeline);
  }, [m1CF.cashflows, timeline]);

  // Shared assumptions — purchase price defaults to model-computed 12.5% IRR price
  // Note: after 5-module split —
  //   m2PurchasePrice reads from new M2 (performing CF) module state
  //   m2LegalDDRate reads from new M3 (defaults/losses) module state
  //   period indices read from new M4 (resolution strategies) module state
  const assumptions = useMemo<SharedAssumptions>(() => {
    const m3Asmp = state.modules.m3.assumptions;
    const m5Asmp = state.modules.m5.assumptions;
    const stateRates: Record<string, number> = { ...DEFAULT_ASSUMPTIONS.recoveryStateRates };
    for (const [k, v] of Object.entries(m3Asmp)) {
      if (k.startsWith('appState_')) stateRates[k.slice(9)] = v;
    }
    return {
      ...DEFAULT_ASSUMPTIONS,
      m2PurchasePrice: state.modules.m2.assumptions['purchasePrice'] ?? parPrice,
      m2LegalDDRate: m3Asmp['legalDDRate'] ?? DEFAULT_ASSUMPTIONS.m2LegalDDRate,
      m3ASalePeriodIdx: state.modules.m4.assumptions['aSalePeriodIdx'] ?? DEFAULT_ASSUMPTIONS.m3ASalePeriodIdx,
      m3BSalePeriodIdx: state.modules.m4.assumptions['bSalePeriodIdx'] ?? DEFAULT_ASSUMPTIONS.m3BSalePeriodIdx,
      m3ASaleYield60: state.modules.m4.assumptions['aSaleYield60'] ?? DEFAULT_ASSUMPTIONS.m3ASaleYield60,
      m3ASaleYield65: state.modules.m4.assumptions['aSaleYield65'] ?? DEFAULT_ASSUMPTIONS.m3ASaleYield65,
      m3ASaleYield70: state.modules.m4.assumptions['aSaleYield70'] ?? DEFAULT_ASSUMPTIONS.m3ASaleYield70,
      m3BReperformingSaleYield: state.modules.m4.assumptions['bReperformingSaleYield'] ?? DEFAULT_ASSUMPTIONS.m3BReperformingSaleYield,
      m3DPOPeriodIdx: state.modules.m4.assumptions['dpoPeriodIdx'] ?? DEFAULT_ASSUMPTIONS.m3DPOPeriodIdx,
      m3DPOInterestDiscountRate: m3Asmp['dpoInterestDiscountRate'] ?? DEFAULT_ASSUMPTIONS.m3DPOInterestDiscountRate,
      m3DPOPrincipalDiscountRate: m3Asmp['dpoPrincipalDiscountRate'] ?? DEFAULT_ASSUMPTIONS.m3DPOPrincipalDiscountRate,
      m4NJResolutionMonths: state.modules.m4.assumptions['njResolutionMonths'] ?? DEFAULT_ASSUMPTIONS.m4NJResolutionMonths,
      m4JResolutionMonths: state.modules.m4.assumptions['jResolutionMonths'] ?? DEFAULT_ASSUMPTIONS.m4JResolutionMonths,
      m4NJForceCostRate: state.modules.m4.assumptions['njForceCostRate'] ?? DEFAULT_ASSUMPTIONS.m4NJForceCostRate,
      m4JForceCostRate: state.modules.m4.assumptions['jForceCostRate'] ?? DEFAULT_ASSUMPTIONS.m4JForceCostRate,
      m4ServicerFeeRate: state.modules.m4.assumptions['servicerFeeRate'] ?? DEFAULT_ASSUMPTIONS.m4ServicerFeeRate,
      recoveryAppA: m3Asmp['recoveryAppA'] ?? 0,
      recoveryAppB: m3Asmp['recoveryAppB'] ?? 0,
      recoveryAppC: m3Asmp['recoveryAppC'] ?? 0,
      recoveryAppD: m3Asmp['recoveryAppD'] ?? 0,
      recoveryStateRates: stateRates,
      m5LolAdvanceRate: m5Asmp['lolAdvanceRate'] ?? DEFAULT_ASSUMPTIONS.m5LolAdvanceRate,
      m5LolReleaseRate: m5Asmp['lolReleaseRate'] ?? DEFAULT_ASSUMPTIONS.m5LolReleaseRate,
      m5LolInterestRate: m5Asmp['lolInterestRate'] ?? DEFAULT_ASSUMPTIONS.m5LolInterestRate,
      m5LolPrepayPenaltyRate: m5Asmp['lolPrepayPenaltyRate'] ?? DEFAULT_ASSUMPTIONS.m5LolPrepayPenaltyRate,
      m5LolArrangementFeeUpfront: m5Asmp['lolArrangementFeeUpfront'] ?? DEFAULT_ASSUMPTIONS.m5LolArrangementFeeUpfront,
      m5LolArrangementFeeTail: m5Asmp['lolArrangementFeeTail'] ?? DEFAULT_ASSUMPTIONS.m5LolArrangementFeeTail,
      m5LolLegalDD: m5Asmp['lolLegalDD'] ?? DEFAULT_ASSUMPTIONS.m5LolLegalDD,
      m5LolUpfrontCapitalised: m5Asmp['lolUpfrontCapitalised'] ?? DEFAULT_ASSUMPTIONS.m5LolUpfrontCapitalised,
    };
  }, [state.modules.m2.assumptions, state.modules.m3.assumptions, state.modules.m4.assumptions, state.modules.m5.assumptions, parPrice]);

  // Module 2 CF: with defaults/losses (servicer fee applies from Module 2 onwards)
  const m2CF = useMemo(() => {
    return buildM2CashFlow(effectiveLoans, timeline, assumptions.m2PurchasePrice, assumptions.m2LegalDDRate, assumptions.m4ServicerFeeRate);
  }, [effectiveLoans, timeline, assumptions.m2PurchasePrice, assumptions.m2LegalDDRate, assumptions.m4ServicerFeeRate]);

  // Price at which M2 cashflows (with defaults/losses) yield 12.5% XIRR
  // Period-0 outflow = PP * (1 + legalDDRate), so PP = PV(future CFs) / (1 + legalDDRate)
  const m2PriceAt12pct = useMemo(() => {
    const pv = solvePriceForXIRR(0.125, m2CF.cashflows.slice(1), timeline);
    return pv / (1 + assumptions.m2LegalDDRate);
  }, [m2CF.cashflows, timeline, assumptions.m2LegalDDRate]);

  // Recovery Analysis CF: hold-to-maturity with forecast collateral (appreciation/depreciation)
  const recoveryCF = useMemo(() => {
    return buildRecoveryCashFlow(
      effectiveLoans, timeline,
      assumptions.m2PurchasePrice,
      assumptions.m2LegalDDRate,
      { A: assumptions.recoveryAppA, B: assumptions.recoveryAppB, C: assumptions.recoveryAppC, D: assumptions.recoveryAppD },
      assumptions.recoveryStateRates,
      assumptions.m4ServicerFeeRate,
    );
  }, [effectiveLoans, timeline, assumptions]);

  const recoveryPriceAt12pct = useMemo(() => {
    const pv = solvePriceForXIRR(0.125, recoveryCF.cashflows.slice(1), timeline);
    return pv / (1 + assumptions.m2LegalDDRate);
  }, [recoveryCF.cashflows, timeline, assumptions.m2LegalDDRate]);

  // Module 3 CF: resolution strategies
  const m3CF = useMemo(() => {
    return buildM3CashFlow(
      effectiveLoans, timeline,
      assumptions.m2PurchasePrice,
      assumptions.m2LegalDDRate,
      assumptions.m3ASalePeriodIdx,
      assumptions.m3BSalePeriodIdx,
      assumptions.m3DPOPeriodIdx,
      assumptions.m4NJResolutionMonths,
      assumptions.m4JResolutionMonths,
      assumptions.m4NJForceCostRate,
      assumptions.m4JForceCostRate,
      assumptions.m4ServicerFeeRate,
      assumptions.m3DPOInterestDiscountRate,
      assumptions.m3DPOPrincipalDiscountRate,
      assumptions.m3ASaleYield60,
      assumptions.m3ASaleYield65,
      assumptions.m3ASaleYield70,
      assumptions.m3BReperformingSaleYield,
    );
  }, [effectiveLoans, timeline, assumptions]);

  // Price at which M3 cashflows (active resolution) yield 12.5% XIRR
  // Future CFs (period 1+) are independent of purchase price, so this is always valid
  const m3PriceAt12pct = useMemo(() => {
    const pv = solvePriceForXIRR(0.125, m3CF.cashflows.slice(1), timeline);
    return pv / (1 + assumptions.m2LegalDDRate);
  }, [m3CF.cashflows, timeline, assumptions.m2LegalDDRate]);

  // Module 4 CF: LoL financing
  const m4CF = useMemo(() => {
    return buildM4CashFlow(effectiveLoans, m3CF.cashflows, timeline, assumptions.m2PurchasePrice, {
      advanceRate: assumptions.m5LolAdvanceRate,
      releaseRate: assumptions.m5LolReleaseRate,
      interestRate: assumptions.m5LolInterestRate,
      prepayPenaltyRate: assumptions.m5LolPrepayPenaltyRate,
      arrangementFeeUpfront: assumptions.m5LolArrangementFeeUpfront,
      arrangementFeeTail: assumptions.m5LolArrangementFeeTail,
      legalDD: assumptions.m5LolLegalDD,
      upfrontCapitalised: assumptions.m5LolUpfrontCapitalised !== 0,
    }, assumptions.m2LegalDDRate);
  }, [effectiveLoans, timeline, m3CF.cashflows, assumptions]);

  // IRR/MoIC — XIRR uses actual day counts, matching Excel =XIRR(cashflows, dates)
  const m1IRR = useMemo(() => xirr(m1CF.cashflows, timeline), [m1CF.cashflows, timeline]);
  const m1MoIC = useMemo(() => calcMoIC(m1CF.cashflows), [m1CF.cashflows]);
  const m2IRR = useMemo(() => xirr(m2CF.cashflows, timeline), [m2CF.cashflows, timeline]);
  const m2MoIC = useMemo(() => calcMoIC(m2CF.cashflows), [m2CF.cashflows]);
  const m3IRR = useMemo(() => xirr(m3CF.cashflows, timeline), [m3CF.cashflows, timeline]);
  const m3MoIC = useMemo(() => calcMoIC(m3CF.cashflows), [m3CF.cashflows]);
  const m4IRR = useMemo(() => xirr(m4CF.cashflows, timeline), [m4CF.cashflows, timeline]);
  const m4MoIC = useMemo(() => calcMoIC(m4CF.cashflows), [m4CF.cashflows]);
  const recoveryIRR = useMemo(() => xirr(recoveryCF.cashflows, timeline), [recoveryCF.cashflows, timeline]);
  const recoveryMoIC = useMemo(() => calcMoIC(recoveryCF.cashflows), [recoveryCF.cashflows]);

  // Persist on every state change
  useEffect(() => {
    saveState(state);
    if (state.session) saveStudentRecord(state);
  }, [state]);

  // Show a loading screen while the loan tape data chunk is fetching.
  if (loanTape.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900 mx-auto mb-4" />
          <p className="text-slate-600 text-sm font-medium">Loading portfolio data…</p>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{
      state, assumptions, dispatch, timeline, effectiveLoans,
      m1CF, m2CF, m3CF, m4CF, recoveryCF,
      m1IRR, m1MoIC, m2IRR, m2MoIC, m3IRR, m3MoIC, m4IRR, m4MoIC,
      recoveryIRR, recoveryMoIC,
      m1PriceAt12pct, m2PriceAt12pct, m3PriceAt12pct, recoveryPriceAt12pct,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
