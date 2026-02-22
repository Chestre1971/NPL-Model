import { useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fmt } from '../../lib/format';
import { buildM1CashFlow } from '../../lib/cashflow';
import { StatCard } from '../shared/StatCard';
import { CashFlowChart } from '../shared/CashFlowChart';
import { CashFlowTable } from '../shared/CashFlowTable';
import { BucketChart } from '../shared/BucketChart';
import { TextAnswerInput } from '../shared/AnswerInput';
import { QuestionBlock } from '../shared/QuestionBlock';
import { PageShell } from '../shared/PageShell';

export function Module2View() {
  const { m1CF, effectiveLoans, timeline, state, dispatch } = useApp();
  const isComplete = state.modules.m2?.completed ?? false;

  const totalDebt = effectiveLoans.reduce((s, l) => s + l.amount, 0);
  const m1TotalPrincipal = m1CF.periods.reduce((s, p) => s + p.principalRepayment, 0);

  const bucketCFs = useMemo(() => {
    const configs = [
      { rf: 'A', interestColor: '#22c55e', principalColor: '#15803d', label: 'A Loans (LTV  70%)' },
      { rf: 'B', interestColor: '#fbbf24', principalColor: '#d97706', label: 'B Loans (7185% LTV)' },
      { rf: 'C', interestColor: '#f97316', principalColor: '#c2410c', label: 'C Loans (86100% LTV)' },
      { rf: 'D', interestColor: '#f87171', principalColor: '#b91c1c', label: 'D Loans (>100% LTV)' },
    ];
    return configs.map(cfg => {
      const loans = effectiveLoans.filter(l => l.riskFactor === cfg.rf);
      const cf = buildM1CashFlow(loans, timeline, 0);
      const data = cf.periods
        .filter(p => p.periodIdx === 0 || p.isIPD)
        .map(p => ({
          name: p.label,
          interest: p.interestPayment,
          principal: p.principalRepayment,
          outstanding: p.outstandingPrincipal / 1e6,
        }));
      return { ...cfg, data };
    });
  }, [effectiveLoans, timeline]);

  return (
    <PageShell>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Performing Baseline</h2>
        <p className="text-slate-500 text-sm mt-1">All loans assumed performing — interest current, principal repaid at maturity</p>
      </div>

      {/* Background & Instructions */}
      <div className="border border-slate-200 rounded-xl mb-4 px-4 pb-4">
        <h4 className="font-semibold text-slate-800 py-3 border-b border-slate-100 mb-3">Background &amp; Instructions</h4>
        <div className="space-y-4 text-sm text-slate-600">

          <div>
            <p className="font-semibold text-slate-800 mb-1">Background</p>
            <p>
              Having reviewed the loan tape and stratification data, your manager has asked you to
              model the cash flows for the full portfolio under a <strong>performing baseline</strong> 
              assuming all loans pay interest current and repay principal in full at maturity.
              This provides the foundation for pricing and later stress-testing in subsequent modules.
            </p>
          </div>

          <div>
            <p className="mb-3">
              The cash flow model has been built for you based on the following assumptions.
              The portfolio cash flows are displayed in tables and charts below — use the
              <strong> Export CSV</strong> button on the cash flow table to download the monthly
              data and run your own calculations in Excel.
            </p>
            <p className="font-semibold text-slate-800 mb-1">Assumptions</p>
            <ul className="list-disc ml-5 space-y-1.5">
              <li>All loans are <strong>fixed interest, bullet repayment</strong> (full principal at maturity, no amortization).</li>
              <li>All loans are assumed to be <strong>paying current</strong> (no defaults in this module).</li>
              <li>Interest is paid quarterly on the <strong>last day of the month</strong>, starting 30 Jun 2026.</li>
              <li>All principal repayments occur on an Interest Payment Date (IPD) / end of quarter.</li>
              <li>Portfolio is acquired at par on <strong>31 Mar 2026</strong>.</li>
              <li>A simplifying assumption of <strong>no asset management fee</strong> has been used.</li>
            </ul>
          </div>

        </div>
      </div>

      {/* Summary KPIs  informational only; students calculate question answers from export */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard label="Total Debt (Par)" value={fmt.currencyM(totalDebt)} color="blue" />
        <StatCard label="Total Principal" value={fmt.currencyM(m1TotalPrincipal)} color="blue" />
      </div>

      {/* Per-Bucket Charts */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-slate-900 mb-1">Cash Flows by Sub-Portfolio (Performing Baseline)</h3>
        <p className="text-xs text-slate-500 mb-3">
          All loans assumed performing — interest paid quarterly, principal at maturity. Gold line = outstanding balance.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {bucketCFs.map(cfg => (
            <BucketChart
              key={cfg.rf}
              data={cfg.data}
              title={cfg.label}
              interestColor={cfg.interestColor}
              principalColor={cfg.principalColor}
              showOutstanding
            />
          ))}
        </div>
      </div>

      {/* Aggregate Cash Flow Chart & Table */}
      <CashFlowChart periods={m1CF.periods} title="Aggregate Quarterly Cash Flows (Performing Baseline)" />
      <CashFlowTable
        periods={m1CF.periods}
        purchasePrice={totalDebt}
        exportLabel="M2_PerformingBaseline"
      />

      {/* Questions */}
      <div className="mt-6 mb-6">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Questions</h3>
        <p className="text-sm text-slate-500 mb-6">
          Use the baseline assumptions and cash flow timing shown above.
        </p>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <QuestionBlock num="Q1" title="Why this is an upper bound">
            <TextAnswerInput
              questionId="pb_q_upper_bound"
              module="m2"
              label="Why should the performing baseline be treated as an upper bound in this assignment?"
              rows={5}
            />
          </QuestionBlock>
          <QuestionBlock num="Q2" title="Timing vs IRR">
            <TextAnswerInput
              questionId="pb_q_timing_vs_irr"
              module="m2"
              label="Explain why two scenarios with similar total cash can still have very different IRRs."
              rows={5}
            />
          </QuestionBlock>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={() => dispatch({ type: 'MARK_COMPLETE', module: 'm2' })}
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

