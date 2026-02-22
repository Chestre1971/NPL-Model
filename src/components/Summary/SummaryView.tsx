import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { fmt } from '../../lib/format';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { PageShell } from '../shared/PageShell';
import { TextAnswerInput } from '../shared/AnswerInput';
import { QuestionBlock } from '../shared/QuestionBlock';
import { solvePriceForXIRR, xirr, calcMoIC } from '../../lib/irr';
import { buildM3CashFlow } from '../../lib/module3';
import { buildM4CashFlow } from '../../lib/module4';
import { parseDate, isIPD, quarterDayCountFraction } from '../../lib/dateUtils';
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

//  Main view 

export function SummaryView() {
  const [targetIRR, setTargetIRR] = useState(0.125);
  const {
    m1CF,
    recoveryCF,
    m3CF,
    assumptions, effectiveLoans, timeline,
  } = useApp();

  const totalDebt = effectiveLoans.reduce((s, l) => s + l.amount, 0);
  const ldd = 1 + assumptions.m2LegalDDRate;

  const progressiveRows = useMemo(() => {
    type ProgressiveRow = {
      label: string;
      bid: number;
      totalReturns: number;
      irr: number;
      moic: number;
      colorClass: string;
      purchasePrice?: number;
      equityBid?: number;
    };
    const n = timeline.length;
    const zeros = () => new Array(n).fill(0);
    const add = (a: number[], b: number[]) => a.map((v, i) => v + (b[i] ?? 0));
    const repayPeriodIdx = (repayStr: string) => {
      const repay = parseDate(repayStr);
      for (let i = 0; i < n; i++) {
        if (timeline[i] >= repay && isIPD(timeline[i])) return i;
      }
      return n - 1;
    };
    const stageFromPeriodic = (periodic: number[], outstandingByPeriod?: number[]) => {
      const cash = new Array(n).fill(0);
      cash[0] = -(totalDebt * ldd);
      for (let i = 1; i < n; i++) {
        let servicerFee = 0;
        if (outstandingByPeriod && assumptions.m4ServicerFeeRate > 0 && isIPD(timeline[i])) {
          servicerFee = outstandingByPeriod[i] * assumptions.m4ServicerFeeRate * quarterDayCountFraction(timeline[i]);
        }
        cash[i] = (periodic[i] ?? 0) - servicerFee;
      }
      return cash;
    };
    const buildOutstanding = (stage: 'enf' | 'a' | 'b' | 'c') => {
      const out = new Array(n).fill(0);
      const aSaleIdx = assumptions.m3ASalePeriodIdx;
      const bSaleIdx = assumptions.m3BSalePeriodIdx;
      const dpoIdx = assumptions.m3DPOPeriodIdx;
      const njIdx = m3CF.dEnforcement.nonJudicialPeriodIdx;
      const jIdx = m3CF.dEnforcement.judicialPeriodIdx;
      for (const loan of effectiveLoans) {
        const repayIdx = repayPeriodIdx(loan.repaymentDate || loan.maturity);
        if (loan.riskFactor === 'A') {
          const exitIdx = stage === 'enf' ? repayIdx : Math.min(repayIdx, aSaleIdx);
          for (let i = 0; i <= exitIdx && i < n; i++) out[i] += loan.amount;
          continue;
        }
        if (loan.riskFactor === 'B') {
          const noBReperformingSale = bSaleIdx >= n - 1;
          if (stage === 'enf' || stage === 'a' || noBReperformingSale) {
            for (let i = 0; i <= repayIdx && i < n; i++) out[i] += loan.amount;
          } else {
            const exitIdx = Math.min(repayIdx, bSaleIdx);
            const cureAmt = Math.max(0, loan.amount - 0.70 * loan.collateralValue);
            const newPrincipal = loan.amount - cureAmt;
            for (let i = 0; i <= exitIdx && i < n; i++) {
              out[i] += i <= aSaleIdx ? loan.amount : newPrincipal;
            }
          }
          continue;
        }
        if (loan.riskFactor === 'C') {
          const exitIdx = stage === 'c' ? Math.min(repayIdx, dpoIdx) : repayIdx;
          for (let i = 0; i <= exitIdx && i < n; i++) out[i] += loan.amount;
          continue;
        }
        if (loan.riskFactor === 'D') {
          const exitIdx = loan.judicial === 'J' ? jIdx : njIdx;
          for (let i = 0; i <= exitIdx && i < n; i++) out[i] += loan.amount;
        }
      }
      return out;
    };
    const buildLeveredAtPrice = (purchasePrice: number, m3ParCashOverride?: number[]) => {
      const m3Cashflows = m3ParCashOverride
        ? (() => {
          const c = [...m3ParCashOverride];
          c[0] = -(purchasePrice * ldd);
          return c;
        })()
        : buildM3CashFlow(
          effectiveLoans,
          timeline,
          purchasePrice,
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
        ).cashflows;
      const m4 = buildM4CashFlow(effectiveLoans, m3Cashflows, timeline, purchasePrice, {
        advanceRate: assumptions.m5LolAdvanceRate,
        releaseRate: assumptions.m5LolReleaseRate,
        interestRate: assumptions.m5LolInterestRate,
        prepayPenaltyRate: assumptions.m5LolPrepayPenaltyRate,
        arrangementFeeUpfront: assumptions.m5LolArrangementFeeUpfront,
        arrangementFeeTail: assumptions.m5LolArrangementFeeTail,
        legalDD: assumptions.m5LolLegalDD,
        upfrontCapitalised: assumptions.m5LolUpfrontCapitalised !== 0,
      }, assumptions.m2LegalDDRate);
      const irr = xirr(m4.cashflows, timeline);
      const equityIn = Math.abs(Math.min(0, m4.cashflows[0] ?? 0));
      return { irr, equityIn, cashflows: m4.cashflows };
    };
    const passiveA = zeros();
    const passiveB = zeros();
    const passiveC = zeros();
    recoveryCF.subPortfolios.forEach(sp => {
      sp.periods.forEach((p, i) => {
        const cf = p.interestPayment + p.principalRepayment + p.loanLosses;
        if (sp.riskFactor === 'A') passiveA[i] += cf;
        if (sp.riskFactor === 'B') passiveB[i] += cf;
        if (sp.riskFactor === 'C') passiveC[i] += cf;
      });
    });

    const activeA = zeros();
    const activeB = zeros();
    const activeC = zeros();
    m3CF.periods.forEach(p => {
      activeA[p.periodIdx] = (p.aInterest ?? 0) + (p.aPrincipal ?? 0);
      activeB[p.periodIdx] = (p.bInterest ?? 0) + (p.bPrincipal ?? 0);
      activeC[p.periodIdx] = (p.cInterest ?? 0) + (p.cPrincipal ?? 0);
    });
    const dEnf = [...m3CF.dEnforcement.periodicCash];

    const enforcementPeriodic = add(add(passiveA, passiveB), add(passiveC, dEnf));
    const aStepPeriodic = add(add(activeA, passiveB), add(passiveC, dEnf));
      const bStepPeriodic = add(add(activeA, activeB), add(passiveC, dEnf));
    const cStepPeriodic = add(add(activeA, activeB), add(activeC, dEnf));
    const enforcementOutstanding = buildOutstanding('enf');
    const aStepOutstanding = buildOutstanding('a');
    const bStepOutstanding = buildOutstanding('b');
    const cStepOutstanding = buildOutstanding('c');
    const enforcementParCash = stageFromPeriodic(enforcementPeriodic, enforcementOutstanding);
    const noActiveMode = (
      assumptions.m3ASalePeriodIdx >= n - 1
      && assumptions.m3BSalePeriodIdx >= n - 1
      && assumptions.m3DPOPeriodIdx >= n - 1
    );

    const mkUnlevered = (label: string, parCash: number[], colorClass: string, bidOverride?: number): ProgressiveRow => {
      const bid = bidOverride ?? (solvePriceForXIRR(targetIRR, parCash.slice(1), timeline) / ldd);
      const cashBid = [...parCash];
      cashBid[0] = -(bid * ldd);
      const irr = xirr(cashBid, timeline);
      const moic = calcMoIC(cashBid);
      return { label, bid, totalReturns: cashBid.reduce((s, v) => s + v, 0), irr, moic, colorClass };
    };

    const baselineRow = mkUnlevered('Performing Baseline', [...m1CF.cashflows], 'text-slate-700');
    const recoveryRow = mkUnlevered('Recovery Analysis', [...recoveryCF.cashflows], 'text-amber-800');
    const enforcementRow = mkUnlevered('Enforcement Scenario', enforcementParCash, 'text-blue-800');
    const anchoredBid = enforcementRow.bid;

    const rows: ProgressiveRow[] = [
      baselineRow,
      recoveryRow,
      enforcementRow,
      mkUnlevered('A Strategy Applied', noActiveMode ? enforcementParCash : stageFromPeriodic(aStepPeriodic, aStepOutstanding), 'text-green-700', anchoredBid),
      mkUnlevered('B Strategy Applied', noActiveMode ? enforcementParCash : stageFromPeriodic(bStepPeriodic, bStepOutstanding), 'text-green-700', anchoredBid),
      mkUnlevered('C Strategy Applied (Full Active)', noActiveMode ? enforcementParCash : stageFromPeriodic(cStepPeriodic, cStepOutstanding), 'text-green-800', anchoredBid),
    ];

    const lolAtActive = buildLeveredAtPrice(anchoredBid, noActiveMode ? enforcementParCash : undefined);
    const lolBid = anchoredBid;
    const lolCashBid = lolAtActive.cashflows;
    rows.push({
      label: 'Loan-on-Loan Financing',
      bid: lolBid,
      purchasePrice: anchoredBid,
      equityBid: lolAtActive.equityIn,
      totalReturns: lolCashBid.reduce((s, v) => s + v, 0),
      irr: lolAtActive.irr,
      moic: calcMoIC(lolCashBid),
      colorClass: 'text-indigo-800',
    });

    const commentaryByLabel: Record<string, string> = {
      'Performing Baseline': 'Full principal and interest on every loan. No defaults or losses.',
      'Recovery Analysis': 'D-loans collect no interest; recovery constrained by collateral shortfall.',
      'Enforcement Scenario': 'Passive D-loan recovery replaced with enforcement proceeds net of legal cost/timing drag.',
      'A Strategy Applied': 'A-loans sold early to performing buyers; duration falls and capital recycles faster.',
      'B Strategy Applied': 'Borrowers cure to covenant level, then re-performing loans are sold at tighter yields.',
      'C Strategy Applied (Full Active)': 'DPO closes C-loans via negotiated payoff; certainty and timing are traded against discounts.',
      'Loan-on-Loan Financing': 'Leverage overlays equity returns when asset yield remains above financing cost.',
    };

    return rows.map((r, i) => {
      const prevBid = i === 0 ? null : rows[i - 1].bid;
      const deltaBid = prevBid == null ? null : r.bid - prevBid;
      return {
        ...r,
        prevBid,
        deltaBid,
        commentary: commentaryByLabel[r.label] ?? '',
      };
    });
  }, [timeline, ldd, assumptions, effectiveLoans, m1CF.cashflows, recoveryCF.cashflows, recoveryCF.subPortfolios, m3CF.periods, m3CF.dEnforcement.periodicCash, targetIRR]);

  const activeIrrMoicData = useMemo(() => {
    const picks = [
      { label: 'Enforcement Scenario', stage: 'Enforcement' },
      { label: 'A Strategy Applied', stage: 'A Step' },
      { label: 'B Strategy Applied', stage: 'B Step' },
      { label: 'C Strategy Applied (Full Active)', stage: 'C Step' },
    ];
    return picks.map(p => {
      const row = progressiveRows.find(r => r.label === p.label);
      return {
        stage: p.stage,
        irrPct: (row?.irr ?? 0) * 100,
        moic: row?.moic ?? 0,
      };
    });
  }, [progressiveRows]);

  return (
    <PageShell>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Return Bridge</h2>
        <p className="text-slate-500 text-sm mt-1">
          Incremental IRR impact at each step — Heron Capital NPL Portfolio
        </p>
      </div>

      <div className="mb-8 border border-slate-200 rounded-xl overflow-hidden bg-white">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-800">Progressive Returns (Live at Bid Price)</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Baseline through Enforcement purchase price updates with target IRR. Active Resolution and LoL capital basis are anchored to the Enforcement bid price.
          </p>
        </div>
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <label className="text-sm font-semibold text-slate-700 w-44 shrink-0">Target IRR (Unlevered)</label>
            <input
              type="range"
              min={10}
              max={24}
              step={0.5}
              value={targetIRR * 100}
              onChange={(e) => setTargetIRR(Number(e.target.value) / 100)}
              className="flex-1 accent-blue-700"
            />
            <span className="text-xl font-bold text-blue-700 w-20 text-right">{fmt.pct(targetIRR)}</span>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase">Scenario</th>
              <th className="px-4 py-2.5 text-right font-semibold text-slate-500 uppercase">Capital Basis (Bid)</th>
              <th className="px-4 py-2.5 text-right font-semibold text-slate-500 uppercase">vs Prior</th>
              <th className="px-4 py-2.5 text-right font-semibold text-slate-500 uppercase">Total Returns (Bid)</th>
              <th className="px-4 py-2.5 text-right font-semibold text-slate-500 uppercase">IRR at Bid</th>
              <th className="px-4 py-2.5 text-right font-semibold text-slate-500 uppercase">MoIC at Bid</th>
              <th className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase">Driver</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {progressiveRows.map((row) => (
              <tr key={row.label}>
                <td className={`px-4 py-2.5 font-semibold ${row.colorClass}`}>{row.label}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {row.label === 'Loan-on-Loan Financing' ? (
                    (() => {
                      const ar = assumptions.m5LolAdvanceRate;
                      const solvedPurchase = typeof row.purchasePrice === 'number' ? row.purchasePrice : row.bid;
                      const equityBid = typeof row.equityBid === 'number' ? row.equityBid : (ar < 1 ? solvedPurchase * (1 - ar) : solvedPurchase);
                      const debtFunded = solvedPurchase * ar;
                      return (
                        <div>
                          <div className="font-semibold text-indigo-800">{fmt.currencyM(solvedPurchase)}</div>
                          <div className="text-xs text-slate-500">
                            Debt {fmt.currencyM(debtFunded)} / Equity {fmt.currencyM(equityBid)}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    fmt.currencyM(row.bid)
                  )}
                </td>
                <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${row.deltaBid == null ? 'text-slate-400' : row.deltaBid >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {row.deltaBid == null ? 'Starting point' : `${row.deltaBid >= 0 ? '+' : '-'}${fmt.currencyM(Math.abs(row.deltaBid))}`}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{fmt.currencyM(row.totalReturns)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-green-700">{fmt.pct(row.irr)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-green-700">{fmt.x(row.moic)}</td>
                <td className="px-4 py-2.5 text-sm text-slate-500">{row.commentary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/*  Bid price bridge  */}
      <div className="mb-8">
        {(() => {
          const bidBaseline = progressiveRows.find(r => r.label === 'Performing Baseline')?.bid ?? 0;
          const bidRecovery = progressiveRows.find(r => r.label === 'Recovery Analysis')?.bid ?? 0;
          const bidActive = progressiveRows.find(r => r.label === 'C Strategy Applied (Full Active)')?.bid ?? 0;
          return (
            <>
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Maximum Bid Price at Target IRR — How Active Management Creates Capacity
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-sm text-slate-500 mb-0.5 font-medium">Performing Baseline</p>
            <p className="text-sm text-slate-400 mb-2">Upper bound — no losses assumed</p>
            <p className="text-2xl font-black text-slate-700">{fmt.currencyM(bidBaseline)}</p>
            <p className="text-sm text-slate-400 mt-1">{fmt.pct(bidBaseline / totalDebt - 1)} vs par ({fmt.currencyM(totalDebt)})</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-600 mb-0.5 font-medium">Recovery Analysis (floor)</p>
            <p className="text-sm text-red-400 mb-2">Passive hold, recognise losses</p>
            <p className="text-2xl font-black text-red-700">{fmt.currencyM(bidRecovery)}</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingDown size={12} className="text-red-500" />
              <p className="text-sm text-red-500 font-semibold">{fmt.currencyM(bidRecovery - bidBaseline)} vs Performing</p>
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-sm text-green-600 mb-0.5 font-medium">Active Resolution (working bid)</p>
            <p className="text-sm text-green-400 mb-2">Active management recovers value</p>
            <p className="text-2xl font-black text-green-700">{fmt.currencyM(bidActive)}</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp size={12} className="text-green-500" />
              <p className="text-sm text-green-600 font-semibold">+{fmt.currencyM(bidActive - bidRecovery)} vs Recovery</p>
            </div>
          </div>
        </div>
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
          <strong>Value of active management:</strong> The gap between the Recovery Analysis floor ({fmt.currencyM(bidRecovery)}) and Active Resolution bid ({fmt.currencyM(bidActive)}) is{' '}
          <strong>{fmt.currencyM(bidActive - bidRecovery)}</strong> — bid capacity unlocked by A-sale, B-cure, C-DPO and D-enforcement at a {fmt.pct(targetIRR)} target IRR.
        </div>
            </>
          );
        })()}
      </div>

      <div className="mb-8 border border-slate-200 rounded-xl p-5 bg-white">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">IRR vs MoIC - Active Resolution Steps</h3>
        <p className="text-sm text-slate-500 mb-3">
          At the same enforcement-anchored purchase price, A/B/C actions pull cash forward, so IRR rises while MoIC declines.
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={activeIrrMoicData} margin={{ top: 8, right: 16, left: 16, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
            <YAxis
              yAxisId="irr"
              orientation="left"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `${v.toFixed(1)}%`}
              domain={['auto', 'auto']}
            />
            <YAxis
              yAxisId="moic"
              orientation="right"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `${v.toFixed(2)}x`}
              domain={['auto', 'auto']}
            />
            <Tooltip
              formatter={(v, name) => {
                if (v == null) return '';
                if (name === 'IRR') return `${Number(v).toFixed(2)}%`;
                return `${Number(v).toFixed(2)}x`;
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line yAxisId="irr" type="monotone" dataKey="irrPct" name="IRR" stroke="#15803d" strokeWidth={2.5} dot={{ r: 4 }} />
            <Line yAxisId="moic" type="monotone" dataKey="moic" name="MoIC" stroke="#1d4ed8" strokeWidth={2.5} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-xs text-slate-500 mt-3">
          Interpretation: IRR is more timing-sensitive than MoIC. Early monetization (A sale, B cure/sale, C DPO) shortens duration and boosts annualized return, while total cash multiple compresses as hold-period carry is reduced.
        </p>
      </div>

      <div className="mb-8 bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Summary Questions</h3>
        <p className="text-sm text-slate-500 mb-4">Use the return bridge and scenario progression shown on this page.</p>
        <QuestionBlock num="Q1" title="Largest bridge step">
          <TextAnswerInput
            questionId="sum_q_largest_step"
            module="m1"
            label="In the return bridge, which transition contributes the largest incremental value and why?"
            rows={5}
          />
        </QuestionBlock>
        <QuestionBlock num="Q2" title="Risk of one-number IRR view">
          <TextAnswerInput
            questionId="sum_q_single_irr_risk"
            module="m1"
            label="Why is it risky to present only one final IRR number without the bridge decomposition?"
            rows={5}
          />
        </QuestionBlock>
        <QuestionBlock num="Q3" title="First downside sensitivity">
          <TextAnswerInput
            questionId="sum_q_sensitivity_first"
            module="m1"
            label="If you changed one assumption for a downside stress test, which would you test first and why?"
            rows={5}
          />
        </QuestionBlock>
      </div>

    </PageShell>
  );
}



