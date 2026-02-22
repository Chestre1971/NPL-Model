import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { fmt } from '../../lib/format';
import { StatCard } from '../shared/StatCard';
import { TextAnswerInput } from '../shared/AnswerInput';
import { QuestionBlock } from '../shared/QuestionBlock';
import { BucketChart } from '../shared/BucketChart';
import { CheckCircle2 } from 'lucide-react';
import { parseDate, isIPD, quarterDayCountFraction, fmtMonthYear } from '../../lib/dateUtils';
import { solvePriceForXIRR, xirr } from '../../lib/irr';
import { PageShell } from '../shared/PageShell';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell,
} from 'recharts';

export function Module4View() {
  const { m3CF, assumptions, timeline, effectiveLoans,
    m1CF, recoveryCF, dispatch, state } = useApp();
  const isComplete = state.modules.m4?.completed ?? false;
  const targetIRR = 0.125;
  const { aSubPortfolios, bCure, cDPO, dEnforcement, periods: m3Periods } = m3CF;

  const purchasePrice = assumptions.m2PurchasePrice;
  const legalDDRate = assumptions.m2LegalDDRate;
  const ldd = 1 + legalDDRate;

  // Price discovery: bid prices at custom target IRR
  const performingBidAtTarget = useMemo(
    () => solvePriceForXIRR(targetIRR, m1CF.cashflows.slice(1), timeline) / ldd,
    [targetIRR, m1CF.cashflows, timeline, ldd]
  );
  const recoveryBidAtTarget = useMemo(
    () => solvePriceForXIRR(targetIRR, recoveryCF.cashflows.slice(1), timeline) / ldd,
    [targetIRR, recoveryCF.cashflows, timeline, ldd]
  );
  const enforcementCashAtPar = useMemo(() => {
    const n = timeline.length;
    const cash = new Array(n).fill(0);
    cash[0] = -(purchasePrice * ldd);

    const nonDRecoveryPeriodic = new Array(n).fill(0);
    recoveryCF.subPortfolios
      .filter(sp => sp.riskFactor !== 'D')
      .forEach(sp => {
        sp.periods.forEach((p, i) => {
          nonDRecoveryPeriodic[i] += p.interestPayment + p.principalRepayment + p.loanLosses;
        });
      });

    const getRepayIdx = (repayStr: string): number => {
      const repayDate = parseDate(repayStr);
      for (let i = 0; i < n; i++) {
        if (timeline[i] >= repayDate && isIPD(timeline[i])) return i;
      }
      return n - 1;
    };
    const out = new Array(n).fill(0);
    for (const loan of effectiveLoans) {
      const naturalIdx = getRepayIdx(loan.repaymentDate || loan.maturity);
      const resolveIdx = loan.riskFactor === 'D'
        ? (loan.judicial === 'J' ? dEnforcement.judicialPeriodIdx : dEnforcement.nonJudicialPeriodIdx)
        : naturalIdx;
      for (let i = 0; i <= resolveIdx && i < n; i++) out[i] += loan.amount;
    }

    for (let i = 1; i < n; i++) {
      const servicerFee = isIPD(timeline[i])
        ? out[i] * assumptions.m4ServicerFeeRate * quarterDayCountFraction(timeline[i])
        : 0;
      cash[i] = nonDRecoveryPeriodic[i] + (dEnforcement.periodicCash[i] ?? 0) - servicerFee;
    }
    return cash;
  }, [
    timeline,
    purchasePrice,
    ldd,
    recoveryCF.subPortfolios,
    dEnforcement.periodicCash,
    dEnforcement.judicialPeriodIdx,
    dEnforcement.nonJudicialPeriodIdx,
    effectiveLoans,
    assumptions.m4ServicerFeeRate,
  ]);

  const enforcementBidAtTarget = useMemo(
    () => solvePriceForXIRR(targetIRR, enforcementCashAtPar.slice(1), timeline) / ldd,
    [targetIRR, enforcementCashAtPar, timeline, ldd]
  );
  const anchoredActiveBidAtTarget = enforcementBidAtTarget;
  const noActiveMode = (
    assumptions.m3ASalePeriodIdx >= timeline.length - 1
    && assumptions.m3BSalePeriodIdx >= timeline.length - 1
    && assumptions.m3DPOPeriodIdx >= timeline.length - 1
  );

  const baselineCashAtBid = useMemo(() => {
    const cfs = [...m1CF.cashflows];
    cfs[0] = -(performingBidAtTarget * ldd);
    return cfs;
  }, [m1CF.cashflows, performingBidAtTarget, ldd]);

  const recoveryCashAtBid = useMemo(() => {
    const cfs = [...recoveryCF.cashflows];
    cfs[0] = -(recoveryBidAtTarget * ldd);
    return cfs;
  }, [recoveryCF.cashflows, recoveryBidAtTarget, ldd]);

  const enforcementCashAtBid = useMemo(() => {
    const cfs = [...enforcementCashAtPar];
    cfs[0] = -(enforcementBidAtTarget * ldd);
    return cfs;
  }, [enforcementCashAtPar, enforcementBidAtTarget, ldd]);

  const activeCashAtBid = useMemo(() => {
    if (noActiveMode) {
      const cfs = [...enforcementCashAtPar];
      cfs[0] = -(anchoredActiveBidAtTarget * ldd);
      return cfs;
    }
    const cfs = [...m3CF.cashflows];
    cfs[0] = -(anchoredActiveBidAtTarget * ldd);
    return cfs;
  }, [noActiveMode, enforcementCashAtPar, m3CF.cashflows, anchoredActiveBidAtTarget, ldd]);

  const baselineIRRAtBid = useMemo(() => xirr(baselineCashAtBid, timeline), [baselineCashAtBid, timeline]);
  const recoveryIRRAtBid = useMemo(() => xirr(recoveryCashAtBid, timeline), [recoveryCashAtBid, timeline]);
  const enforcementIRRAtBid = useMemo(() => xirr(enforcementCashAtBid, timeline), [enforcementCashAtBid, timeline]);
  const activeIRRAtBid = useMemo(() => xirr(activeCashAtBid, timeline), [activeCashAtBid, timeline]);

  const baselineMoICAtBid = useMemo(() => {
    const inflows = baselineCashAtBid.slice(1).reduce((s, v) => s + v, 0);
    return performingBidAtTarget > 0 ? inflows / (performingBidAtTarget * ldd) : 0;
  }, [baselineCashAtBid, performingBidAtTarget, ldd]);

  const recoveryMoICAtBid = useMemo(() => {
    const inflows = recoveryCashAtBid.slice(1).reduce((s, v) => s + v, 0);
    return recoveryBidAtTarget > 0 ? inflows / (recoveryBidAtTarget * ldd) : 0;
  }, [recoveryCashAtBid, recoveryBidAtTarget, ldd]);

  const enforcementMoICAtBid = useMemo(() => {
    const inflows = enforcementCashAtBid.slice(1).reduce((s, v) => s + v, 0);
    return enforcementBidAtTarget > 0 ? inflows / (enforcementBidAtTarget * ldd) : 0;
  }, [enforcementCashAtBid, enforcementBidAtTarget, ldd]);

  const activeMoICAtBid = useMemo(() => {
    const inflows = activeCashAtBid.slice(1).reduce((s, v) => s + v, 0);
    return anchoredActiveBidAtTarget > 0 ? inflows / (anchoredActiveBidAtTarget * ldd) : 0;
  }, [activeCashAtBid, anchoredActiveBidAtTarget, ldd]);

  const totalReturnBaselineBid = useMemo(() => baselineCashAtBid.reduce((s, v) => s + v, 0), [baselineCashAtBid]);
  const totalReturnRecoveryBid = useMemo(() => recoveryCashAtBid.reduce((s, v) => s + v, 0), [recoveryCashAtBid]);
  const totalReturnEnforcementBid = useMemo(() => enforcementCashAtBid.reduce((s, v) => s + v, 0), [enforcementCashAtBid]);
  const totalReturnActiveBid = useMemo(() => activeCashAtBid.reduce((s, v) => s + v, 0), [activeCashAtBid]);

  // Per-bucket outstanding: tracks when each loan leaves the books under resolution strategy
  const m4Outstanding = useMemo(() => {
    const getRepayIdx = (repayStr: string): number => {
      const repayDate = parseDate(repayStr);
      for (let i = 0; i < timeline.length; i++) {
        if (timeline[i] >= repayDate && isIPD(timeline[i])) return i;
      }
      return timeline.length - 1;
    };
    const n = timeline.length;
    const out: Record<'A' | 'B' | 'C' | 'D', number[]> = {
      A: new Array(n).fill(0),
      B: new Array(n).fill(0),
      C: new Array(n).fill(0),
      D: new Array(n).fill(0),
    };
    const aSaleIdx = assumptions.m3ASalePeriodIdx;
    const bSaleIdx = assumptions.m3BSalePeriodIdx;
    const cDPOIdx = assumptions.m3DPOPeriodIdx;
    const njIdx = dEnforcement.nonJudicialPeriodIdx;
    const jIdx = dEnforcement.judicialPeriodIdx;

    for (const loan of effectiveLoans) {
      const rf = loan.riskFactor as 'A' | 'B' | 'C' | 'D';
      const naturalIdx = getRepayIdx(loan.repaymentDate || loan.maturity);
      let resolveIdx: number;
      if (rf === 'A') resolveIdx = Math.min(naturalIdx, aSaleIdx);
      else if (rf === 'B') resolveIdx = Math.min(naturalIdx, bSaleIdx);
      else if (rf === 'C') resolveIdx = Math.min(naturalIdx, cDPOIdx);
      else resolveIdx = loan.judicial === 'J' ? jIdx : njIdx;
      for (let i = 0; i <= resolveIdx && i < n; i++) out[rf][i] += loan.amount;
    }
    return out;
  }, [effectiveLoans, timeline, assumptions, dEnforcement]);

  // Per-bucket resolution CF data for BucketChart
  const bucketCFs4 = useMemo(() => {
    const configs = [
      { rf: 'A' as const, key: 'aPrincipal' as const, interestKey: 'aInterest' as const, label: 'A Loans - Sub-Portfolio Sale', interestColor: '#22c55e', principalColor: '#15803d' },
      { rf: 'B' as const, key: 'bPrincipal' as const, interestKey: 'bInterest' as const, label: 'B Loans - Cure + Re-performing Sale', interestColor: '#fbbf24', principalColor: '#d97706' },
      { rf: 'C' as const, key: 'cPrincipal' as const, interestKey: 'cInterest' as const, label: 'C Loans - DPO', interestColor: '#f97316', principalColor: '#c2410c' },
    ];
    return configs.map(cfg => {
      const data = m3Periods
        .filter(p => p.periodIdx === 0 || p.isIPD)
        .map(p => {
          const val = p[cfg.key] as number;
          const interest = p[cfg.interestKey] as number;
          return {
            name: p.label,
            interest,
            principal: Math.max(0, val),
            losses: Math.min(0, val),
            outstanding: m4Outstanding[cfg.rf][p.periodIdx] / 1e6,
          };
        });
      return { ...cfg, data };
    });
  }, [m3Periods, m4Outstanding]);

  // Recovery Analysis bucket charts for side-by-side comparison
  const bucketCFs3 = useMemo(() => {
    const recSubPortfolios = recoveryCF.subPortfolios;
    const recPeriods = recoveryCF.periods;
    const configs = [
      { rf: 'A' as const, interestColor: '#22c55e', principalColor: '#15803d', label: 'A Loans - Passive Hold' },
      { rf: 'B' as const, interestColor: '#fbbf24', principalColor: '#d97706', label: 'B Loans - Passive Hold' },
      { rf: 'C' as const, interestColor: '#f97316', principalColor: '#c2410c', label: 'C Loans - Passive Hold' },
    ];
    const rfs = ['A', 'B', 'C'] as const;
    return recSubPortfolios.map((sp, i) => {
      const cfg = configs[i];
      const rf = rfs[i];
      let outstanding = effectiveLoans.filter(l => l.riskFactor === rf).reduce((s, l) => s + l.amount, 0);
      const data: { name: string; interest: number; principal: number; losses: number; outstanding: number }[] = [];
      sp.periods.forEach((p, idx) => {
        const period = recPeriods[idx];
        if (period.periodIdx === 0 || period.isIPD) {
          data.push({ name: period.label, interest: p.interestPayment, principal: p.principalRepayment, losses: p.loanLosses, outstanding: outstanding / 1e6 });
        }
        outstanding -= p.principalRepayment;
      });
      return { ...cfg, data };
    });
  }, [recoveryCF, effectiveLoans]);
  const bNoSaleMode = assumptions.m3BSalePeriodIdx >= timeline.length - 1;
  const cNoDpoMode = assumptions.m3DPOPeriodIdx >= timeline.length - 1;
  const bCureIdx = Math.max(0, Math.min(assumptions.m3ASalePeriodIdx, m3Periods.length - 1));
  const bQ2Idx = Math.max(0, Math.min(bCureIdx + 3, m3Periods.length - 1));
  const bSaleIdx = Math.max(0, Math.min(assumptions.m3BSalePeriodIdx, m3Periods.length - 1));
  const periodLabel = (idx: number) => timeline[idx] ? fmtMonthYear(timeline[idx]) : `T+${idx}`;
  const aSaleLabel = periodLabel(assumptions.m3ASalePeriodIdx);
  const bSaleLabel = periodLabel(assumptions.m3BSalePeriodIdx);
  const dpoLabel = periodLabel(assumptions.m3DPOPeriodIdx);
  const bAnalysisChartData = useMemo(() => {
    if (bNoSaleMode) {
      return m3Periods
        .filter(p => p.periodIdx > 0 && p.isIPD)
        .map(p => ({
          period: p.label,
          Interest: (p.bInterest ?? 0) / 1e6,
          'Cure Payment': 0,
          'Sale Proceeds': 0,
          'Principal Repayment': (p.bPrincipal ?? 0) / 1e6,
        }))
        .filter(r => r.Interest !== 0 || r['Principal Repayment'] !== 0);
    }
    return [
      {
        period: m3Periods[bCureIdx]?.label ?? 'Cure Date',
        Interest: bCure.interestQ1 / 1e6,
        'Cure Payment': bCure.totalCurePayments / 1e6,
        'Sale Proceeds': 0,
        'Principal Repayment': 0,
      },
      {
        period: m3Periods[bQ2Idx]?.label ?? 'Interim',
        Interest: bCure.interestQ2 / 1e6,
        'Cure Payment': 0,
        'Sale Proceeds': 0,
        'Principal Repayment': 0,
      },
      {
        period: m3Periods[bSaleIdx]?.label ?? 'Sale Date',
        Interest: bCure.interestQ3 / 1e6,
        'Cure Payment': 0,
        'Sale Proceeds': bCure.rePerformingSalePrice / 1e6,
        'Principal Repayment': 0,
      },
    ];
  }, [bNoSaleMode, m3Periods, bCureIdx, bQ2Idx, bSaleIdx, bCure]);

  const strategyExplain: Record<'A' | 'B' | 'C', { heading: string; summary: string; context: string; timing: string }> = useMemo(() => ({
    A: {
      heading: 'A Loans - Sale of Performing Loans',
      summary: 'These are the strongest credits in the book. The strategy monetizes them early through portfolio sales to performing-loan buyers, converting longer-dated cash flow into near-term proceeds.',
      context: 'Compared with passive hold, the active path pulls cash forward and reduces carry duration. This usually lifts IRR, while the final MoIC impact depends on sale pricing versus hold-to-maturity proceeds.',
      timing: `Model timing: sale at ${aSaleLabel}, with yield-based pricing by sub-portfolio.`,
    },
    B: {
      heading: 'B Loans - Cure Payments and Re-performing Sale',
      summary: 'These loans sit in a covenant breach band. The strategy is to force a denominator cure (principal paydown), then sell the cured loans as re-performing paper.',
      context: 'The value driver is the borrower cure cash plus a cleaner post-cure sale profile. Relative to passive hold, this removes downside from lingering covenant stress and shortens time to monetization.',
      timing: `Model timing: cure at ${aSaleLabel}, re-performing sale at ${bSaleLabel}.`,
    },
    C: {
      heading: 'C Loans - Discounted Payoff (DPO)',
      summary: 'These are near-par LTV but weaker credits. The strategy seeks negotiated exits through discounted payoff, exchanging some nominal claim value for earlier and more certain cash realization.',
      context: 'The trade-off versus passive hold is explicit: accept a haircut to reduce duration and execution uncertainty. The chart highlights where principal is given up and when resolution cash is actually received.',
      timing: `Model timing: DPO at ${dpoLabel}, with principal/interest discounts from assumptions.`,
    },
  }), [aSaleLabel, bSaleLabel, dpoLabel]);

  return (
    <PageShell>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Active Resolution - A, B &amp; C Strategies</h2>
        <p className="text-slate-500 text-sm mt-1">Sub-portfolio sale, covenant cure &amp; DPO - value creation above the enforcement floor</p>
      </div>

      {/* Background & Instructions */}
      <div className="border border-slate-200 rounded-xl mb-4 px-4 pb-4">
        <h4 className="font-semibold text-slate-800 py-3 border-b border-slate-100 mb-3">Background &amp; Instructions</h4>
        <div className="space-y-4 text-sm text-slate-600">

          <div>
            <p className="font-semibold text-slate-800 mb-1">From Enforcement to Active Resolution</p>
            <p className="text-sm">
              In the Enforcement module you established what Heron receives from D-loans through forced
              legal process - the coercive floor. D-loans are fully addressed there. This module covers
              the three complementary strategies for <strong>A, B, and C loans</strong>, each tailored
              to the specific collateral position and borrower dynamic of that risk bucket.
            </p>
            <p className="text-sm mt-2">
              Together, these four elements - A-loan sale, B-loan cure, C-loan DPO, and D-loan
              enforcement - form the complete active resolution toolkit that determines Heron's real
              bid price. The combined IRR and MoIC here reflect the <strong>full portfolio strategy</strong>
              including D-loan enforcement proceeds.
            </p>
          </div>

          <div>
            <p className="font-semibold text-slate-800 mb-2">A Loans - Sale of Performing Loans</p>
            <ul className="list-disc ml-5 space-y-1.5 text-sm">
              <li>
                Loans grouped into sub-portfolios by LTV cutoff, sold to bank/debt fund buyers at effective yields:
                <ul className="list-none ml-4 mt-1 font-mono space-y-0.5">
                  <li>Portfolio A - LTV &lt;= 60%, yield <strong>{fmt.pct(assumptions.m3ASaleYield60)}</strong></li>
                  <li>Portfolio B - LTV &lt;= 65%, yield <strong>{fmt.pct(assumptions.m3ASaleYield65)}</strong></li>
                  <li>Portfolio C - LTV &lt;= 70%, yield <strong>{fmt.pct(assumptions.m3ASaleYield70)}</strong></li>
                </ul>
              </li>
              <li>Sale at <strong>{aSaleLabel}</strong>. Heron can pre-market or hold to maturity to engineer IRR vs. MoIC.</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-slate-800 mb-2">B Loans - Cure Payments &amp; Re-performing Sale</p>
            <ul className="list-disc ml-5 space-y-1.5 text-sm">
              <li>B Loans (71-85% LTV) breach the 70% LTV covenant. Heron issues a Notice of Default within 30 days of closing.</li>
              <li>Borrowers cure at <strong>{aSaleLabel}</strong> via a principal paydown (denominator cure) to bring LTV to &lt;= 70%.</li>
              <li>Re-performing portfolio sold at <strong>{bSaleLabel}</strong> at <strong>{fmt.pct(assumptions.m3BReperformingSaleYield)}</strong> effective yield.</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-slate-800 mb-2">C Loans - Discounted Payoff (DPO)</p>
            <ul className="list-disc ml-5 space-y-1.5 text-sm">
              <li>C Loans (86-100% LTV) sold back to borrowers at a discount at <strong>{dpoLabel}</strong>.</li>
              <li>DPO discount rates: <strong>{fmt.pct(assumptions.m3DPOInterestDiscountRate)}</strong> for future interest income and <strong>{fmt.pct(assumptions.m3DPOPrincipalDiscountRate)}</strong> for principal.</li>
              <li>Loans maturing before {dpoLabel} repay at par. No payment default assumed for C Loans in this module.</li>
            </ul>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500">
            <strong className="text-slate-600">D Loans:</strong> Covered in the Enforcement module. Proceeds from
            non-judicial (T+18) and judicial (T+36) enforcement are included in the combined returns above.
          </div>

        </div>
      </div>

      {/* Per-Bucket Comparison: Active Resolution vs Passive Hold */}
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900 mb-1">Active Resolution by Strategy - Description then Analysis</h3>
        <p className="text-sm text-slate-500 mb-4">
          Each section is presented in order (A, B, C): strategy description first, then passive-vs-active cash flow analysis.
          Left chart is Recovery Analysis (passive hold). Right chart is Active Resolution.
        </p>
        <p className="text-sm text-slate-500 mb-4">
          Clarification: cash flows shown before each modeled strategy event (sale, cure/sale, or DPO) are assumed to be
          normal contractual repayments received before that event date. The strategy event then applies only to the
          remaining outstanding balance at that time.
        </p>
        <div className="space-y-5">
          {bucketCFs4.map((active, i) => {
            const passive = bucketCFs3[i];
            const explain = strategyExplain[active.rf as 'A' | 'B' | 'C'];

            const activeStackMax = Math.max(...active.data.map(d => (d.interest || 0) + (d.principal || 0)));
            const passiveStackMax = Math.max(...passive.data.map(d => (d.interest || 0) + (d.principal || 0)));
            const activeMin = Math.min(0, ...active.data.map(d => d.losses || 0));
            const passiveMin = Math.min(0, ...passive.data.map(d => d.losses || 0));
            const cashMax = Math.max(activeStackMax, passiveStackMax) * 1.08;
            const cashMin = Math.min(activeMin, passiveMin);
            const yAxisDomain: [number, number] = [cashMin, cashMax];

            const activeOutMax = Math.max(...active.data.map(d => d.outstanding || 0));
            const passiveOutMax = Math.max(...passive.data.map(d => d.outstanding || 0));
            const outAxisMax = Math.max(activeOutMax, passiveOutMax) * 1.08;

            return (
              <div key={active.rf} className="border border-slate-200 rounded-xl p-4">
                <div className="mb-3">
                  <p className="text-base font-semibold text-slate-800 mb-1">{explain.heading}</p>
                  <p className="text-sm text-slate-600 mb-1.5">{explain.summary}</p>
                  <p className="text-sm text-slate-600 mb-1.5">{explain.context}</p>
                  <p className="text-sm text-slate-500">{explain.timing}</p>
                </div>
                {active.rf === 'A' && (
                  <div className="mt-4 bg-green-50/40 border border-green-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-green-900 mb-2">A Loan Sale Analysis</p>
                    <p className="text-sm text-green-800 mb-3">
                      Portfolio sale pricing is shown below by LTV bucket. In practice, Heron can choose between faster monetization
                      and maximizing total dollars, depending on buyer demand and targeted hold-period returns.
                    </p>
                    <p className="text-sm text-green-800 mb-3">
                      Any cash flows before the sale date are assumed to be normal repayments collected prior to disposal.
                      The sale transaction is applied to the residual outstanding balance at the modeled sale date.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                      {aSubPortfolios.map(p => (
                        <div key={p.label} className="bg-white border border-green-200 rounded-lg p-3">
                          <p className="text-sm font-semibold text-green-900">{p.label}</p>
                          <p className="text-sm text-green-800">Loans: <span className="font-semibold">{p.loans.length}</span></p>
                          <p className="text-sm text-green-800">Yield: <span className="font-semibold">{fmt.pct(p.yield)}</span></p>
                          <p className="text-sm text-green-800">Sale price: <span className="font-semibold">{fmt.currencyM(p.salePrice)}</span></p>
                        </div>
                      ))}
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={aSubPortfolios.map(p => ({
                          name: p.label.split('(')[0].trim(),
                          'Sale Price': p.salePrice / 1e6,
                        }))}
                        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={v => `$${v.toFixed(0)}m`} tick={{ fontSize: 10 }} width={58} />
                        <Tooltip formatter={(v: number | undefined) => v != null ? `$${v.toFixed(1)}m` : ''} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Sale Price" name="Sale Price ($m)" radius={[3, 3, 0, 0]}>
                          <Cell fill="#16a34a" />
                          <Cell fill="#22c55e" />
                          <Cell fill="#4ade80" />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {active.rf === 'B' && (
                  <div className="mt-4 bg-amber-50/40 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-amber-900 mb-2">B Loan Cure and Re-performance Analysis</p>
                    <p className="text-sm text-amber-800 mb-1.5">
                      The key underwriting question is borrower willingness and ability to cure. A successful cure converts a stressed
                      covenant position into saleable re-performing credit.
                    </p>
                    <p className="text-sm text-amber-800 mb-3">
                      The chart and metrics isolate timing risk: if cures are delayed or incomplete, the expected sale value and return profile deteriorate.
                    </p>
                    <p className="text-sm text-amber-800 mb-3">
                      Pre-event cash flows represent contractual receipts before cure/sale execution. Cure and re-performing
                      sale assumptions are then applied to the remaining balance at their modeled dates.
                    </p>
                    {bNoSaleMode && (
                      <p className="text-sm text-amber-800 mb-3 font-medium">
                        Re-performing sale date is at the model horizon, so no active sale is applied; contractual B-loan cash flows are shown.
                      </p>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      <StatCard label="Total Cure Payments" value={fmt.currencyM(bNoSaleMode ? 0 : bCure.totalCurePayments)} color="amber" />
                      <StatCard label="Post-Cure Balance" value={fmt.currencyM(bCure.postCureLoanBalance)} />
                      <StatCard label="Re-performing Sale Price" value={fmt.currencyM(bNoSaleMode ? 0 : bCure.rePerformingSalePrice)} color="green" />
                      <StatCard label="Q1 Interest" value={fmt.currencyM(bNoSaleMode ? 0 : bCure.interestQ1)} />
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={bAnalysisChartData}
                        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                        <YAxis tickFormatter={v => `$${v.toFixed(0)}m`} tick={{ fontSize: 10 }} width={58} />
                        <Tooltip formatter={(v: number | undefined) => v != null ? `$${v.toFixed(1)}m` : ''} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Interest" stackId="a" fill="#fbbf24" name="Interest" />
                        <Bar dataKey="Cure Payment" stackId="a" fill="#f59e0b" name="Cure Payment" />
                        <Bar dataKey="Sale Proceeds" stackId="a" fill="#22c55e" name="Re-performing Sale" radius={[3, 3, 0, 0]} />
                        {bNoSaleMode && <Bar dataKey="Principal Repayment" stackId="a" fill="#15803d" name="Principal Repayment" radius={[3, 3, 0, 0]} />}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {active.rf === 'C' && (
                  <div className="mt-4 bg-orange-50/40 border border-orange-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-orange-900 mb-2">C Loan DPO Analysis</p>
                    <p className="text-sm text-orange-800 mb-1.5">
                      C loans are a negotiated outcome strategy. The underwriting focus is on execution certainty, borrower refinance capacity,
                      and whether accepting a discount today creates better risk-adjusted value than waiting for maturity.
                    </p>
                    <p className="text-sm text-orange-800 mb-3">
                      This section isolates when cash is realized and how much value is exchanged through the DPO discount mechanism.
                    </p>
                    <p className="text-sm text-orange-800 mb-3">
                      Cash flows received before the DPO date are treated as normal pre-resolution repayments. The DPO
                      discount is applied to the residual claim outstanding at the modeled DPO event date.
                    </p>
                    {cNoDpoMode && (
                      <p className="text-sm text-orange-800 mb-3 font-medium">
                        DPO date is at the model horizon, so no DPO event is applied; contractual C-loan cash flows continue.
                      </p>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                      <StatCard label="DPO Proceeds" value={fmt.currencyM(cDPO.totalDPOProceeds)} color="amber" />
                      <StatCard label="Pre-Q4 Par Repayments" value={fmt.currencyM(cDPO.totalPreQ4Repayments)} />
                      <StatCard label="Total C Loan Cash" value={fmt.currencyM(cDPO.totalDPOProceeds + cDPO.totalPreQ4Repayments)} color="blue" />
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={(cNoDpoMode ? [] : cDPO.periodicCash
                          .map((v, idx) => ({ v, period: m3Periods[idx] }))
                          .filter(d => d.v > 0 && d.period?.isIPD)
                          .map(d => ({
                            period: d.period.label,
                            cash: d.v / 1e6,
                          })))}
                        margin={{ top: 4, right: 16, left: 8, bottom: 24 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="period" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
                        <YAxis tickFormatter={v => `$${v.toFixed(0)}m`} tick={{ fontSize: 10 }} width={58} />
                        <Tooltip formatter={(v: number | undefined) => v != null ? `$${v.toFixed(1)}m` : ''} />
                        <Bar dataKey="cash" name="Cash Flow ($m)" radius={[3, 3, 0, 0]} fill="#f97316" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <BucketChart
                    data={passive.data}
                    title={passive.label}
                    showLosses
                    showOutstanding
                    interestColor={passive.interestColor}
                    principalColor={passive.principalColor}
                    yAxisDomain={yAxisDomain}
                    outAxisMax={outAxisMax}
                  />
                  <BucketChart
                    data={active.data}
                    title={active.label}
                    showInterest
                    showLosses
                    showOutstanding
                    principalLabel="Resolution CF"
                    lossesLabel="Removed CF / Cost"
                    interestColor={active.interestColor}
                    principalColor={active.principalColor}
                    yAxisDomain={yAxisDomain}
                    outAxisMax={outAxisMax}
                  />
                </div>

              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900 mb-1">Returns - Active Resolution (Live at Bid Price)</h3>
        <p className="text-sm text-slate-500 mb-3">
          Progressive scenario stack with Active Resolution included at a 12.00% unlevered target IRR.
        </p>
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-sm font-semibold text-slate-500 uppercase">Scenario</th>
                <th className="px-4 py-2.5 text-right text-sm font-semibold text-slate-500 uppercase">Purchase Price (Bid)</th>
                <th className="px-4 py-2.5 text-right text-sm font-semibold text-slate-500 uppercase">Total Returns (Bid)</th>
                <th className="px-4 py-2.5 text-right text-sm font-semibold text-slate-500 uppercase">IRR at Bid</th>
                <th className="px-4 py-2.5 text-right text-sm font-semibold text-slate-500 uppercase">MoIC at Bid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-slate-50/40">
                <td className="px-4 py-2.5 text-sm font-semibold text-slate-700">Performing Baseline</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{fmt.currencyM(performingBidAtTarget)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums text-slate-700">{fmt.currencyM(totalReturnBaselineBid)}</td>
                <td className={`px-4 py-2.5 text-right text-sm tabular-nums font-semibold ${baselineIRRAtBid >= targetIRR ? 'text-green-700' : 'text-amber-700'}`}>{fmt.pct(baselineIRRAtBid)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums font-semibold text-green-700">{fmt.x(baselineMoICAtBid)}</td>
              </tr>
              <tr className="bg-amber-50/40">
                <td className="px-4 py-2.5 text-sm font-semibold text-amber-800">Recovery Analysis</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{fmt.currencyM(recoveryBidAtTarget)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums text-slate-700">{fmt.currencyM(totalReturnRecoveryBid)}</td>
                <td className={`px-4 py-2.5 text-right text-sm tabular-nums font-semibold ${recoveryIRRAtBid >= targetIRR ? 'text-green-700' : 'text-amber-700'}`}>{fmt.pct(recoveryIRRAtBid)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums font-semibold text-green-700">{fmt.x(recoveryMoICAtBid)}</td>
              </tr>
              <tr className="bg-blue-50/40">
                <td className="px-4 py-2.5 text-sm font-semibold text-blue-800">Enforcement Scenario</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{fmt.currencyM(enforcementBidAtTarget)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums font-semibold text-blue-800">{fmt.currencyM(totalReturnEnforcementBid)}</td>
                <td className={`px-4 py-2.5 text-right text-sm tabular-nums font-semibold ${enforcementIRRAtBid >= targetIRR ? 'text-green-700' : 'text-amber-700'}`}>{fmt.pct(enforcementIRRAtBid)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums font-semibold text-green-700">{fmt.x(enforcementMoICAtBid)}</td>
              </tr>
              <tr className="bg-green-50/40">
                <td className="px-4 py-2.5 text-sm font-semibold text-green-800">Active Resolution</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{fmt.currencyM(anchoredActiveBidAtTarget)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums font-semibold text-green-800">{fmt.currencyM(totalReturnActiveBid)}</td>
                <td className={`px-4 py-2.5 text-right text-sm tabular-nums font-semibold ${activeIRRAtBid >= targetIRR ? 'text-green-700' : 'text-amber-700'}`}>{fmt.pct(activeIRRAtBid)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums font-semibold text-green-700">{fmt.x(activeMoICAtBid)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Questions */}
      <div className="mt-6 bg-white border border-slate-200 rounded-xl p-5">
        <h4 className="text-sm font-semibold text-slate-700 mb-5">Questions</h4>
        <QuestionBlock num="Q1" title="A-sale: IRR vs MoIC">
          <TextAnswerInput
            questionId="ar_a_q_irr_moic"
            module="m4"
            label="A-sale: Why can selling A loans early raise IRR but reduce MoIC versus hold-to-maturity?"
            rows={5}
          />
        </QuestionBlock>
        <QuestionBlock num="Q2" title="A-sale: sell now vs hold">
          <TextAnswerInput
            questionId="ar_a_q_sell_vs_hold"
            module="m4"
            label="A-sale: In what market conditions should Heron prefer sell-now versus hold?"
            rows={5}
          />
        </QuestionBlock>
        <QuestionBlock num="Q3" title="B-cure: waiting period">
          <TextAnswerInput
            questionId="ar_b_q_wait_trackrecord"
            module="m4"
            label="B-cure: Why wait before selling re-performing B loans after cure?"
            rows={5}
          />
        </QuestionBlock>
        <QuestionBlock num="Q4" title="B-cure: execution risk">
          <TextAnswerInput
            questionId="ar_b_q_execution_bridge"
            module="m4"
            label="B-cure: What is the key execution risk, and how would failure show up in the return bridge?"
            rows={5}
          />
        </QuestionBlock>
        <QuestionBlock num="Q5" title="C-DPO: principal vs interest discounting">
          <TextAnswerInput
            questionId="ar_c_q_rate_split"
            module="m4"
            label="C-DPO: Why are different discount rates often used for principal vs interest in DPO pricing?"
            rows={5}
          />
        </QuestionBlock>
        <QuestionBlock num="Q6" title="C-DPO: higher-rate execution risk">
          <TextAnswerInput
            questionId="ar_c_q_high_rate_execution"
            module="m4"
            label="C-DPO: How does a higher-rate market reduce DPO execution probability, and what does that imply for underwriting?"
            rows={5}
          />
        </QuestionBlock>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={() => dispatch({ type: 'MARK_COMPLETE', module: 'm4' })}
          disabled={isComplete}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors
            ${isComplete
              ? 'bg-green-100 text-green-700 cursor-default'
              : 'bg-blue-700 text-white hover:bg-blue-800'}`}
        >
          <CheckCircle2 size={15} />
          {isComplete ? 'Submitted' : 'Submit Answers'}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500 text-right">
        After submission, this module is locked and answers cannot be changed unless your instructor unlocks it.
      </p>
    </PageShell>
  );
}





