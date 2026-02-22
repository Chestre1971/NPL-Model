import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fmt } from '../../lib/format';
import { solvePriceForXIRR, xirr } from '../../lib/irr';
import { buildM3CashFlow } from '../../lib/module3';
import { buildM4CashFlow } from '../../lib/module4';
import { parseDate, isIPD, quarterDayCountFraction } from '../../lib/dateUtils';
import { TextAnswerInput } from '../shared/AnswerInput';
import { QuestionBlock } from '../shared/QuestionBlock';
import { PageShell } from '../shared/PageShell';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

export function Module5View() {
  const { m1CF, recoveryCF, m3CF, m4CF, assumptions, timeline, effectiveLoans, state, dispatch } = useApp();
  const isComplete = state.modules.m5?.completed ?? false;
  const { periods, summary } = m4CF;
  const [targetIRR] = useState(0.125);

  const ldd = 1 + assumptions.m2LegalDDRate;

  const enforcingCF = m3CF.dEnforcement;
  const enforcementCashAtPar = useMemo(() => {
    const n = timeline.length;
    const cash = new Array(n).fill(0);
    cash[0] = -(assumptions.m2PurchasePrice * ldd);
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
        ? (loan.judicial === 'J' ? enforcingCF.judicialPeriodIdx : enforcingCF.nonJudicialPeriodIdx)
        : naturalIdx;
      for (let i = 0; i <= resolveIdx && i < n; i++) out[i] += loan.amount;
    }

    for (let i = 1; i < n; i++) {
      const servicerFee = isIPD(timeline[i])
        ? out[i] * assumptions.m4ServicerFeeRate * quarterDayCountFraction(timeline[i])
        : 0;
      cash[i] = nonDRecoveryPeriodic[i] + (enforcingCF.periodicCash[i] ?? 0) - servicerFee;
    }
    return cash;
  }, [
    timeline,
    assumptions.m2PurchasePrice,
    ldd,
    recoveryCF.subPortfolios,
    enforcingCF.periodicCash,
    enforcingCF.judicialPeriodIdx,
    enforcingCF.nonJudicialPeriodIdx,
    effectiveLoans,
    assumptions.m4ServicerFeeRate,
  ]);

  const performingBidAtTarget = useMemo(
    () => solvePriceForXIRR(targetIRR, m1CF.cashflows.slice(1), timeline) / ldd,
    [targetIRR, m1CF.cashflows, timeline, ldd]
  );
  const recoveryBidAtTarget = useMemo(
    () => solvePriceForXIRR(targetIRR, recoveryCF.cashflows.slice(1), timeline) / ldd,
    [targetIRR, recoveryCF.cashflows, timeline, ldd]
  );
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
  const lolAtActiveBid = useMemo(() => {
    let m3CashAtBid: number[];
    if (noActiveMode) {
      m3CashAtBid = [...enforcementCashAtPar];
      m3CashAtBid[0] = -(anchoredActiveBidAtTarget * ldd);
    } else {
      const m3AtBid = buildM3CashFlow(
        effectiveLoans,
        timeline,
        anchoredActiveBidAtTarget,
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
      m3CashAtBid = m3AtBid.cashflows;
    }
    const m4AtBid = buildM4CashFlow(effectiveLoans, m3CashAtBid, timeline, anchoredActiveBidAtTarget, {
      advanceRate: assumptions.m5LolAdvanceRate,
      releaseRate: assumptions.m5LolReleaseRate,
      interestRate: assumptions.m5LolInterestRate,
      prepayPenaltyRate: assumptions.m5LolPrepayPenaltyRate,
      arrangementFeeUpfront: assumptions.m5LolArrangementFeeUpfront,
      arrangementFeeTail: assumptions.m5LolArrangementFeeTail,
      legalDD: assumptions.m5LolLegalDD,
      upfrontCapitalised: assumptions.m5LolUpfrontCapitalised !== 0,
    }, assumptions.m2LegalDDRate);
    return {
      cashflows: m4AtBid.cashflows,
      periods: m4AtBid.periods,
      summary: m4AtBid.summary,
      equityBid: Math.abs(Math.min(0, m4AtBid.cashflows[0] ?? 0)),
      debtBid: anchoredActiveBidAtTarget * assumptions.m5LolAdvanceRate,
      purchaseBid: anchoredActiveBidAtTarget,
    };
  }, [noActiveMode, enforcementCashAtPar, effectiveLoans, timeline, anchoredActiveBidAtTarget, assumptions, ldd]);

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
  const lolCashAtBid = useMemo(() => {
    return [...lolAtActiveBid.cashflows];
  }, [lolAtActiveBid.cashflows]);

  const baselineIRRAtBid = useMemo(() => xirr(baselineCashAtBid, timeline), [baselineCashAtBid, timeline]);
  const recoveryIRRAtBid = useMemo(() => xirr(recoveryCashAtBid, timeline), [recoveryCashAtBid, timeline]);
  const enforcementIRRAtBid = useMemo(() => xirr(enforcementCashAtBid, timeline), [enforcementCashAtBid, timeline]);
  const activeIRRAtBid = useMemo(() => xirr(activeCashAtBid, timeline), [activeCashAtBid, timeline]);
  const lolIRRAtBid = useMemo(() => xirr(lolCashAtBid, timeline), [lolCashAtBid, timeline]);

  const baselineMoICAtBid = useMemo(() => baselineCashAtBid.slice(1).reduce((s, v) => s + v, 0) / (performingBidAtTarget * ldd), [baselineCashAtBid, performingBidAtTarget, ldd]);
  const recoveryMoICAtBid = useMemo(() => recoveryCashAtBid.slice(1).reduce((s, v) => s + v, 0) / (recoveryBidAtTarget * ldd), [recoveryCashAtBid, recoveryBidAtTarget, ldd]);
  const enforcementMoICAtBid = useMemo(() => enforcementCashAtBid.slice(1).reduce((s, v) => s + v, 0) / (enforcementBidAtTarget * ldd), [enforcementCashAtBid, enforcementBidAtTarget, ldd]);
  const activeMoICAtBid = useMemo(() => activeCashAtBid.slice(1).reduce((s, v) => s + v, 0) / (anchoredActiveBidAtTarget * ldd), [activeCashAtBid, anchoredActiveBidAtTarget, ldd]);
  const lolMoICAtBid = useMemo(() => {
    return lolAtActiveBid.equityBid > 0
      ? lolCashAtBid.slice(1).reduce((s, v) => s + v, 0) / lolAtActiveBid.equityBid
      : 0;
  }, [lolCashAtBid, lolAtActiveBid.equityBid]);

  const totalReturnBaselineBid = useMemo(() => baselineCashAtBid.reduce((s, v) => s + v, 0), [baselineCashAtBid]);
  const totalReturnRecoveryBid = useMemo(() => recoveryCashAtBid.reduce((s, v) => s + v, 0), [recoveryCashAtBid]);
  const totalReturnEnforcementBid = useMemo(() => enforcementCashAtBid.reduce((s, v) => s + v, 0), [enforcementCashAtBid]);
  const totalReturnActiveBid = useMemo(() => activeCashAtBid.reduce((s, v) => s + v, 0), [activeCashAtBid]);
  const totalReturnLolBid = useMemo(() => lolCashAtBid.reduce((s, v) => s + v, 0), [lolCashAtBid]);

  // Decomposition using the same period set as the table below:
  // Active/Enforcement CF = Equity CF + LoL CF + leakage (legal/DD at close)
  // LoL CF is shown from lender-receipt perspective:
  //   - negative at close (debt funded), positive thereafter (interest/principal/fees received).
  const allocationChartData = periods
    .filter(p => p.periodIdx === 0 || p.isIPD)
    .map(p => {
      const leakage = p.periodIdx === 0 ? summary.legalDD : 0;
      const lolPrincipalCF = p.periodIdx === 0 ? -summary.initialLoanAmount : p.lolPrincipalRepaid;
      const upfrontFeeCash = (p.periodIdx === 0 && !summary.upfrontCapitalised) ? summary.upfrontFee : 0;
      const lolInterestFeeCF = upfrontFeeCash + p.lolInterest + p.lolPrepayPenalty + p.lolTailFee;
      const lolCF = lolPrincipalCF + lolInterestFeeCF;
      const residual = p.m3NetCashflow - (p.leveredEquityCF + lolCF + leakage);
      return {
        name: p.label,
        activeCF: p.m3NetCashflow / 1e6,
        equityCF: p.leveredEquityCF / 1e6,
        lolCF: lolCF / 1e6,
        lolPrincipalCF: lolPrincipalCF / 1e6,
        lolInterestFeeCF: lolInterestFeeCF / 1e6,
        leakage: leakage / 1e6,
        residual: residual / 1e6,
      };
    });

  const allocationTotals = useMemo(() => {
    const active = allocationChartData.reduce((s, r) => s + r.activeCF, 0);
    const equity = allocationChartData.reduce((s, r) => s + r.equityCF, 0);
    const lol = allocationChartData.reduce((s, r) => s + r.lolCF, 0);
    const leakage = allocationChartData.reduce((s, r) => s + r.leakage, 0);
    const residual = allocationChartData.reduce((s, r) => s + r.residual, 0);
    return { active, equity, lol, leakage, residual };
  }, [allocationChartData]);

  // LoL provider (lender) cash flow view:
  // period 0: debt funded to Heron is negative; arrangement fee received is positive.
  // period i>0: lender receipts are interest, principal, prepay penalties, and tail fee.
  const lolProviderCashflows = useMemo(() => {
    const cfs = lolAtActiveBid.periods.map((p) => {
      if (p.periodIdx === 0) {
        const upfrontFeeReceived = lolAtActiveBid.summary.upfrontCapitalised ? 0 : lolAtActiveBid.summary.upfrontFee;
        // Lender expense reimbursement from borrower/fund under facility terms.
        const legalDDReceived = lolAtActiveBid.summary.legalDD;
        return -lolAtActiveBid.summary.initialLoanAmount + upfrontFeeReceived + legalDDReceived;
      }
      return p.lolInterest + p.lolPrincipalRepaid + p.lolPrepayPenalty + p.lolTailFee;
    });
    return cfs;
  }, [lolAtActiveBid.periods, lolAtActiveBid.summary]);

  const lolProviderIRR = useMemo(
    () => xirr(lolProviderCashflows, timeline),
    [lolProviderCashflows, timeline]
  );
  const lolProviderReceivables = useMemo(
    () => lolProviderCashflows.reduce((s, v) => s + (v > 0 ? v : 0), 0),
    [lolProviderCashflows]
  );
  const lolProviderMoIC = useMemo(
    () => lolAtActiveBid.summary.initialLoanAmount > 0 ? (lolProviderReceivables / lolAtActiveBid.summary.initialLoanAmount) : 0,
    [lolProviderReceivables, lolAtActiveBid.summary.initialLoanAmount]
  );
  const lolProviderProfit = useMemo(
    () => lolProviderCashflows.reduce((s, v) => s + v, 0),
    [lolProviderCashflows]
  );

  const formatM = (v: number) => `$${v.toFixed(0)}m`;

  return (
    <PageShell>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Financing</h2>
        <p className="text-slate-500 text-sm mt-1">Loan-on-Loan (LoL) Financing Overlay</p>
      </div>

      {/* Background & Instructions */}
      <div className="border border-slate-200 rounded-xl mb-4 px-4 pb-4">
        <h4 className="font-semibold text-slate-800 py-3 border-b border-slate-100 mb-3">Background &amp; Instructions</h4>
        <div className="space-y-4 text-sm text-slate-600">

          <div>
            <p className="font-semibold text-slate-800 mb-1">Background</p>
            <p>
              Heron has initiated preliminary discussions with a leading Investment Bank regarding the
              provision of <strong>Loan-on-Loan (LoL) financing</strong> for the acquisition of the
              portfolio. The following draft terms have been negotiated:
            </p>
          </div>

          <div>
            <p className="font-semibold text-slate-800 mb-2">Facility Terms
              <span className="ml-2 text-sm font-normal text-slate-400">(editable in Assumptions tab)</span>
            </p>
            <ol className="list-none ml-2 space-y-1.5 text-sm">
              <li><strong>(i) Term:</strong> 5 years.</li>
              <li>
                <strong>(ii) Loan Amount:</strong> In aggregate{' '}
                <strong>{fmt.pct(assumptions.m5LolAdvanceRate)} of the Allocated Purchase Price (APP)</strong>{' '}
                of each loan. APP is allocated on a pro-rata basis based on the lower of the outstanding
                loan amount or the underlying collateral value.
              </li>
              <li>
                <strong>(iii) Interest:</strong> Fixed rate of{' '}
                <strong>{fmt.pct(assumptions.m5LolInterestRate)} p.a.</strong> (payable quarterly) on the
                outstanding loan balance at quarter end. First IPD: 30 June 2026.
              </li>
              <li>
                <strong>(iv) Release Pricing:</strong> On any repayment, loan sale, DPO, asset sale or
                REO, the borrower must repay{' '}
                <strong>{fmt.pct(assumptions.m5LolReleaseRate)} of the respective APP</strong> on that loan.
              </li>
              <li>
                <strong>(v) Prepayment Penalties:</strong>{' '}
                <strong>{fmt.pct(assumptions.m5LolPrepayPenaltyRate)}</strong> on any principal repayment
                within the first 12 months of the facility.
              </li>
              <li>
                <strong>(vi) Arrangement Fee:</strong>{' '}
                {fmt.pct(assumptions.m5LolArrangementFeeUpfront + assumptions.m5LolArrangementFeeTail)} on
                initial loan amount {' '}
                <strong>
                  {(assumptions.m5LolArrangementFeeUpfront * 10000).toFixed(0)} bps upfront
                  {assumptions.m5LolUpfrontCapitalised !== 0
                    ? ' (capitalised to LoL balance)'
                    : ' (paid current)'}
                </strong>{' '}
                +{' '}
                <strong>{(assumptions.m5LolArrangementFeeTail * 10000).toFixed(0)} bps on full repayment</strong>.
              </li>
              <li>
                <strong>(vii) Legal &amp; DD Costs:</strong>{' '}
                <strong>{fmt.currencyM(assumptions.m5LolLegalDD)}</strong> in aggregate (Fund is
                obligated to pay lender expenses under a cost reimbursement agreement).
              </li>
            </ol>
          </div>

          <div>
            <p className="font-semibold text-slate-800 mb-1">Assignment</p>
            <ol className="list-decimal ml-5 space-y-1 text-sm">
              <li>Calculate the loan portfolio <strong>levered cash flow</strong> and the levered <strong>IRR, MoIC and WAL</strong>.</li>
              <li>Answer all questions within the answer template.</li>
            </ol>
          </div>

        </div>
      </div>

      {/* LoL Terms */}
      <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm">
        <h3 className="font-semibold text-slate-800 mb-3">Loan-on-Loan Facility Terms
          <span className="ml-2 text-sm font-normal text-slate-400">(configurable in Assumptions tab)</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-1 text-sm text-slate-600">
          <div><span className="font-medium">Term:</span> 5 years</div>
          <div><span className="font-medium">Advance Rate:</span> {fmt.pct(assumptions.m5LolAdvanceRate)} of APP</div>
          <div><span className="font-medium">Interest Rate:</span> {fmt.pct(assumptions.m5LolInterestRate)} p.a. (quarterly)</div>
          <div><span className="font-medium">Release Pricing:</span> {fmt.pct(assumptions.m5LolReleaseRate)} of APP per loan</div>
          <div><span className="font-medium">Prepayment Penalty:</span> {fmt.pct(assumptions.m5LolPrepayPenaltyRate)} (first 12 months)</div>
          <div>
            <span className="font-medium">Arrangement Fee:</span>{' '}
            {fmt.pct(assumptions.m5LolArrangementFeeUpfront)} upfront
            {assumptions.m5LolUpfrontCapitalised !== 0
              ? <span className="text-amber-600 font-medium"> (capitalised)</span>
              : <span className="text-slate-400"> (paid current)</span>
            }
            {' '}+ {fmt.pct(assumptions.m5LolArrangementFeeTail)} tail
          </div>
          <div><span className="font-medium">Legal &amp; DD:</span> {fmt.currencyM(assumptions.m5LolLegalDD)}</div>
          <div><span className="font-medium">APP Basis:</span> Pro-rata on min(loan, collateral)</div>
        </div>
      </div>

      <div className="flex flex-col">
      <div className="order-4 mb-4">
        <h3 className="text-base font-bold text-slate-900 mb-1">Returns — Loan-on-Loan (Live at Bid Price)</h3>
        <p className="text-sm text-slate-500 mb-3">
          Progressive returns from Baseline through LoL financing. Active Resolution and LoL capital basis are anchored to the Enforcement bid price.
        </p>
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white mb-5">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-sm font-semibold text-slate-500 uppercase">Scenario</th>
                <th className="px-4 py-2.5 text-right text-sm font-semibold text-slate-500 uppercase">Capital Basis (Bid)</th>
                <th className="px-4 py-2.5 text-right text-sm font-semibold text-slate-500 uppercase">Total Returns (Bid)</th>
                <th className="px-4 py-2.5 text-right text-sm font-semibold text-slate-500 uppercase">IRR at Bid</th>
                <th className="px-4 py-2.5 text-right text-sm font-semibold text-slate-500 uppercase">MoIC at Bid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-slate-50/40">
                <td className="px-4 py-2.5 text-sm font-semibold text-slate-700">Performing Baseline</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{fmt.currencyM(performingBidAtTarget)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{fmt.currencyM(totalReturnBaselineBid)}</td>
                <td className={`px-4 py-2.5 text-right text-sm tabular-nums font-semibold ${baselineIRRAtBid >= targetIRR ? 'text-green-700' : 'text-amber-700'}`}>{fmt.pct(baselineIRRAtBid)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums font-semibold text-green-700">{fmt.x(baselineMoICAtBid)}</td>
              </tr>
              <tr className="bg-amber-50/40">
                <td className="px-4 py-2.5 text-sm font-semibold text-amber-800">Recovery Analysis</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{fmt.currencyM(recoveryBidAtTarget)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{fmt.currencyM(totalReturnRecoveryBid)}</td>
                <td className={`px-4 py-2.5 text-right text-sm tabular-nums font-semibold ${recoveryIRRAtBid >= targetIRR ? 'text-green-700' : 'text-amber-700'}`}>{fmt.pct(recoveryIRRAtBid)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums font-semibold text-green-700">{fmt.x(recoveryMoICAtBid)}</td>
              </tr>
              <tr className="bg-blue-50/40">
                <td className="px-4 py-2.5 text-sm font-semibold text-blue-800">Enforcement Scenario</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{fmt.currencyM(enforcementBidAtTarget)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{fmt.currencyM(totalReturnEnforcementBid)}</td>
                <td className={`px-4 py-2.5 text-right text-sm tabular-nums font-semibold ${enforcementIRRAtBid >= targetIRR ? 'text-green-700' : 'text-amber-700'}`}>{fmt.pct(enforcementIRRAtBid)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums font-semibold text-green-700">{fmt.x(enforcementMoICAtBid)}</td>
              </tr>
              <tr className="bg-green-50/40">
                <td className="px-4 py-2.5 text-sm font-semibold text-green-800">Active Resolution</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{fmt.currencyM(anchoredActiveBidAtTarget)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{fmt.currencyM(totalReturnActiveBid)}</td>
                <td className={`px-4 py-2.5 text-right text-sm tabular-nums font-semibold ${activeIRRAtBid >= targetIRR ? 'text-green-700' : 'text-amber-700'}`}>{fmt.pct(activeIRRAtBid)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums font-semibold text-green-700">{fmt.x(activeMoICAtBid)}</td>
              </tr>
              <tr className="bg-indigo-50/40">
                <td className="px-4 py-2.5 text-sm font-semibold text-indigo-800">Loan-on-Loan Financing</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">
                  <div className="font-semibold text-indigo-800">{fmt.currencyM(lolAtActiveBid.purchaseBid)}</div>
                  <div className="text-xs text-slate-500">
                    Debt {fmt.currencyM(lolAtActiveBid.debtBid)} / Equity {fmt.currencyM(lolAtActiveBid.equityBid)}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{fmt.currencyM(totalReturnLolBid)}</td>
                <td className={`px-4 py-2.5 text-right text-sm tabular-nums font-semibold ${lolIRRAtBid >= targetIRR ? 'text-green-700' : 'text-amber-700'}`}>{fmt.pct(lolIRRAtBid)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums font-semibold text-green-700">{fmt.x(lolMoICAtBid)}</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      {/* 1) Aggregate active/enforcement cash flow */}
      <div className="order-2 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">1) Aggregate Cash Flow (Active/Enforcement)</h3>
        <p className="text-xs text-slate-500 mb-3">
          Total strategy cash flow before capital stack decomposition.
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={allocationChartData} margin={{ top: 4, right: 16, left: 16, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tickFormatter={formatM} tick={{ fontSize: 10 }} width={60} />
            <Tooltip formatter={(v: string | number | undefined) => v != null ? formatM(Number(v)) : ''} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="activeCF" name="Active/Enforcement CF" fill="#c8a84b" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 2) Active CF decomposed into equity, debt and leakage */}
      <div className="order-2 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">2) Aggregate Cash Flow Decomposition (Equity, LoL, Leakage)</h3>
        <p className="text-xs text-slate-500 mb-3">
          Identity by period: <strong>Active/Enforcement CF = Equity CF + LoL CF + Leakage</strong>.
          Leakage is financing legal/DD at close.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
          <div className="border border-slate-200 rounded-lg p-3 bg-white">
            <p className="text-xs text-slate-500">Total Active CF</p>
            <p className="text-lg font-semibold text-slate-800">{fmt.currencyM(allocationTotals.active * 1e6)}</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-3 bg-white">
            <p className="text-xs text-slate-500">Total Equity CF</p>
            <p className="text-lg font-semibold text-slate-800">{fmt.currencyM(allocationTotals.equity * 1e6)}</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-3 bg-white">
            <p className="text-xs text-slate-500">Total LoL CF</p>
            <p className="text-lg font-semibold text-slate-800">{fmt.currencyM(allocationTotals.lol * 1e6)}</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-3 bg-white">
            <p className="text-xs text-slate-500">Leakage / Residual</p>
            <p className="text-sm font-semibold text-slate-700">
              {fmt.currencyM(allocationTotals.leakage * 1e6)} / {fmt.currencyM(allocationTotals.residual * 1e6)}
            </p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={allocationChartData} margin={{ top: 4, right: 16, left: 16, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tickFormatter={formatM} tick={{ fontSize: 10 }} width={60} />
            <Tooltip formatter={(v: string | number | undefined) => v != null ? formatM(Number(v)) : ''} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="equityCF" name="Equity CF" fill="#1e3a5f" stackId="alloc" />
            <Bar dataKey="lolPrincipalCF" name="LoL Principal CF" fill="#f97316" stackId="alloc" />
            <Bar dataKey="lolInterestFeeCF" name="LoL Interest/Fee CF" fill="#ef4444" stackId="alloc" />
            <Bar dataKey="leakage" name="Leakage (Legal/DD)" fill="#94a3b8" stackId="alloc" />
            <Line type="monotone" dataKey="activeCF" name="Active/Enforcement CF" stroke="#c8a84b" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* LoL provider cash flow view */}
      <div className="order-2 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">LoL Provider Cash Flow Waterfall</h3>
        <p className="text-xs text-slate-500 mb-3">
          Debt funded to Heron at closing is negative; all lender receivables (fees, interest, principal, penalties) are positive.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div className="border border-slate-200 rounded-lg p-3 bg-white">
            <p className="text-xs text-slate-500">LoL Provider IRR</p>
            <p className="text-lg font-semibold text-slate-800">{fmt.pct(lolProviderIRR)}</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-3 bg-white">
            <p className="text-xs text-slate-500">LoL Provider MoIC</p>
            <p className="text-lg font-semibold text-slate-800">{fmt.x(lolProviderMoIC)}</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-3 bg-white">
            <p className="text-xs text-slate-500">LoL Provider Profit</p>
            <p className={`text-lg font-semibold ${lolProviderProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {fmt.currencyM(lolProviderProfit)}
            </p>
          </div>
        </div>
      </div>

      {/* Levered CF Table */}
      <div className="order-3 mb-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Levered Period Cash Flows (IPD periods only)</h3>
        <div className="table-scroll border border-slate-200 rounded-xl">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Period', 'Net CF', 'Drawdown', 'LoL Interest', 'LoL Principal', 'Fee / Penalty', 'Equity CF', 'LoL O/S'].map(h => (
                  <th key={h} className="px-3 py-2 text-right font-semibold text-slate-500 uppercase first:text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {periods.filter(p => p.periodIdx === 0 || p.isIPD).map(p => {
                // Period 0: Drawdown = full LoL facility draw (initialLoanAmount); upfront fee shown separately in Fee column.
                // Period i>0: Drawdown = 0; Fee column = prepayment penalty only.
                // Reconciliation:
                //   Paid current: Net CF + Drawdown  upfrontFee  LoL Interest  LoL Principal  PrepayPenalty = Equity CF
                //   Capitalised:  Net CF + Drawdown  LoL Interest  LoL Principal  PrepayPenalty = Equity CF
                const isP0 = p.periodIdx === 0;
                const drawdown = isP0 ? summary.initialLoanAmount : 0;

                // Fee column:
                //   Period 0: upfront arrangement fee (amber if capitalised, red if paid current)
                //   Period i>0: prepay penalty + tail fee (both are equity outflows)
                const feeAmt = isP0 ? summary.upfrontFee : p.lolPrepayPenalty + p.lolTailFee;
                // capitalised upfront fee is NOT an equity outflow  show in amber; paid-current is red (equity cost)
                const feeIsCapitalised = isP0 && summary.upfrontCapitalised;
                const hasTailFee = !isP0 && p.lolTailFee > 0;

                return (
                  <tr key={p.periodIdx} className={p.periodIdx === 0 ? 'bg-slate-100 font-semibold' : 'hover:bg-slate-50'}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{p.label}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${p.m3NetCashflow < 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {p.m3NetCashflow !== 0 ? fmt.currencyM(p.m3NetCashflow) : ''}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-blue-600">
                      {drawdown > 0 ? fmt.currencyM(drawdown) : ''}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-500">
                      {p.lolInterest > 0 ? fmt.currencyM(-p.lolInterest) : ''}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-orange-500">
                      {p.lolPrincipalRepaid > 0 ? fmt.currencyM(-p.lolPrincipalRepaid) : ''}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${feeIsCapitalised ? 'text-amber-500' : 'text-red-400'}`}>
                      {feeAmt > 0
                        ? feeIsCapitalised
                          ? `${fmt.currencyM(feeAmt)} (cap.)`  // capitalised upfront: added to LoL balance
                          : <span>
                              {fmt.currencyM(-feeAmt)}
                              {hasTailFee && (
                                <span className="block text-[10px] text-slate-400 font-normal">
                                  incl. {fmt.currencyM(p.lolTailFee)} tail fee
                                </span>
                              )}
                            </span>
                        : ''}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold
                      ${p.leveredEquityCF < 0 ? 'text-red-600' : p.leveredEquityCF > 0 ? 'text-green-700' : ''}`}>
                      {p.leveredEquityCF !== 0 ? fmt.currencyM(p.leveredEquityCF) : ''}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-400">
                      {p.lolOutstandingEOP > 0 ? fmt.currencyM(p.lolOutstandingEOP) : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      </div>

      {/* Questions */}
      <div className="mt-4 mb-6">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Questions</h3>
        <p className="text-sm text-slate-500 mb-6">
          Use the financing terms and cash flow decomposition above.
        </p>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <QuestionBlock num="Q1" title="Why leverage can increase IRR">
            <TextAnswerInput
              questionId="fin_q_leverage_mechanic"
              module="m5"
              label="Explain the mechanical reason LoL can increase levered IRR while adding financing costs."
              rows={5}
            />
          </QuestionBlock>
          <QuestionBlock num="Q2" title="Release Price vs Advance Rate">
            <TextAnswerInput
              questionId="fin_q_release_liquidity"
              module="m5"
              label="Why is it important for Loan-on-Loan financing to have a release price above the advance rate (as a % of APP) for each loan?"
              rows={5}
            />
          </QuestionBlock>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={() => dispatch({ type: 'MARK_COMPLETE', module: 'm5' })}
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


