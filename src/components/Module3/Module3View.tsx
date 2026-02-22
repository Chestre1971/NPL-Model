import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2 } from 'lucide-react';
import { fmt } from '../../lib/format';
import { solvePriceForXIRR, xirr } from '../../lib/irr';
import { CashFlowChart } from '../shared/CashFlowChart';
import { CashFlowTable } from '../shared/CashFlowTable';
import { BucketChart } from '../shared/BucketChart';
import { TextAnswerInput } from '../shared/AnswerInput';
import { QuestionBlock } from '../shared/QuestionBlock';
import { PageShell } from '../shared/PageShell';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts';

const RISK_COLORS: Record<string, string> = {
  A: 'text-green-700 bg-green-50',
  B: 'text-yellow-700 bg-yellow-50',
  C: 'text-orange-700 bg-orange-50',
  D: 'text-red-700 bg-red-50',
};

const RF_CHART_COLORS: Record<string, string> = {
  A: '#16a34a', B: '#d97706', C: '#ea580c', D: '#dc2626',
};

const RF_LABELS: Record<string, string> = {
  A: 'LTV  70%',
  B: '7185% LTV',
  C: '86100% LTV',
  D: '>100% LTV',
};

export function Module3View() {
  const {
    recoveryCF,
    m1CF, m1IRR, m1MoIC, assumptions, effectiveLoans, timeline, state, dispatch,
  } = useApp();
  const isComplete = state.modules.m3?.completed ?? false;
  const [targetIRR, setTargetIRR] = useState(0.125);
  const { subPortfolios, periods } = recoveryCF;
  const purchasePrice = assumptions.m2PurchasePrice;
  const ldd = 1 + assumptions.m2LegalDDRate;
  const legalDD = purchasePrice * assumptions.m2LegalDDRate;

  const totalInterest = subPortfolios.reduce((s, sp) => s + sp.totalInterest, 0);
  const totalPrincipal = subPortfolios.reduce((s, sp) => s + sp.totalPrincipal, 0);
  const totalLosses = subPortfolios.reduce((s, sp) => s + sp.totalLosses, 0);
  const totalCash = totalInterest + totalPrincipal + totalLosses;
  const profit = totalCash - purchasePrice - legalDD;
  void profit;

  const parValue = useMemo(
    () => effectiveLoans.reduce((s, l) => s + l.amount, 0),
    [effectiveLoans],
  );

  // Returns at par  substitute par as the T=0 outflow; use period end-dates as timeline
  const recoveryTimeline = useMemo(() => periods.map(p => p.eop), [periods]);

  const cfsAtPar = useMemo(() => {
    const cfs = [...recoveryCF.cashflows];
    cfs[0] = -parValue * (1 + assumptions.m2LegalDDRate);
    return cfs;
  }, [recoveryCF.cashflows, parValue, assumptions.m2LegalDDRate]);

  const irrAtPar = useMemo(
    () => xirr(cfsAtPar, recoveryTimeline),
    [cfsAtPar, recoveryTimeline],
  );

  const moicAtPar = totalCash / (parValue * (1 + assumptions.m2LegalDDRate));

  const bucketRates = {
    A: assumptions.recoveryAppA,
    B: assumptions.recoveryAppB,
    C: assumptions.recoveryAppC,
    D: assumptions.recoveryAppD,
  };
  const anyAppreciation = Object.values(bucketRates).some(r => r !== 0) ||
    Object.values(assumptions.recoveryStateRates).some(r => r !== 0);

  // Per-bucket appraisal vs. recovery summary
  const appraisalSummary = useMemo(() => {
    const rfs = ['A', 'B', 'C', 'D'];
    const closingDate = timeline[0];
    return rfs.map((rf, i) => {
      const loans = effectiveLoans.filter(l => l.riskFactor === rf);
      const outstanding = loans.reduce((s, l) => s + l.amount, 0);
      const appraisal = loans.reduce((s, l) => s + l.collateralValue, 0);
      const ltv = outstanding > 0 && appraisal > 0 ? outstanding / appraisal : 0;
      // Base case (0% appreciation): use today's appraisal values
      const recoveryAt0 = loans.reduce((s, l) => s + Math.min(l.amount, l.collateralValue), 0);
      // Forecasted collateral value: apply per-bucket + per-state appreciation to each loan
      const forecastedValue = loans.reduce((s, l) => {
        const matDate = new Date(l.repaymentDate || l.maturity);
        const yearsToMaturity = (matDate.getTime() - closingDate.getTime()) / (365.25 * 24 * 3600 * 1000);
        const annualRate = (bucketRates[l.riskFactor as 'A' | 'B' | 'C' | 'D'] ?? 0)
          + (assumptions.recoveryStateRates[l.jurisdiction] ?? 0);
        return s + l.collateralValue * Math.pow(1 + annualRate, yearsToMaturity);
      }, 0);
      // Current scenario: from model output (reflects any appreciation rates set)
      const sp = subPortfolios[i];
      const recoveryAtRates = sp.totalPrincipal + sp.totalLosses;
      const lossAtRates = sp.totalLosses;
      return { rf, outstanding, appraisal, ltv, forecastedValue, recoveryAt0, recoveryAtRates, lossAtRates };
    });
  }, [effectiveLoans, subPortfolios, timeline, bucketRates, assumptions.recoveryStateRates]);

  // Dynamic price discovery
  const perfBaselinePrice = useMemo(
    () => solvePriceForXIRR(targetIRR, m1CF.cashflows.slice(1), timeline),
    [targetIRR, m1CF.cashflows, timeline],
  );

  const recoveryPrice = useMemo(
    () => solvePriceForXIRR(targetIRR, recoveryCF.cashflows.slice(1), timeline) / ldd,
    [targetIRR, recoveryCF.cashflows, timeline, ldd],
  );

  const bucketChartData = useMemo(() => {
    const configs = [
      { rf: 'A', interestColor: '#22c55e', principalColor: '#15803d', label: 'A Loans — Performing (LTV ≤70%)' },
      { rf: 'B', interestColor: '#fbbf24', principalColor: '#d97706', label: 'B Loans — Near-performing (71–85% LTV)' },
      { rf: 'C', interestColor: '#f97316', principalColor: '#c2410c', label: 'C Loans — High LTV (86–100%)' },
      { rf: 'D', interestColor: '#f87171', principalColor: '#b91c1c', label: 'D Loans — Payment Default (>100% LTV)' },
    ];
    const rfs = ['A', 'B', 'C', 'D'];
    return subPortfolios.map((sp, i) => {
      const cfg = configs[i];
      const rf = rfs[i];
      let outstanding = effectiveLoans
        .filter(l => l.riskFactor === rf)
        .reduce((s, l) => s + l.amount, 0);
      const data: { name: string; interest: number; principal: number; losses: number; outstanding: number }[] = [];
      sp.periods.forEach((p, idx) => {
        const period = periods[idx];
        if (period.periodIdx === 0 || period.isIPD) {
          data.push({
            name: period.label,
            interest: p.interestPayment,
            principal: p.principalRepayment,
            losses: p.loanLosses,
            outstanding: outstanding / 1e6,
          });
        }
        outstanding -= p.principalRepayment;
      });
      return { ...cfg, data };
    });
  }, [subPortfolios, periods, effectiveLoans]);

  return (
    <PageShell>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Recovery Analysis</h2>
        <p className="text-slate-500 text-sm mt-1">
          Hold to maturity — recovery = min(outstanding balance, forecast collateral value)
        </p>
      </div>

      {/*  Merged Background & Key Assumptions  */}
      <div className="border border-slate-200 rounded-xl mb-5 px-4 pb-4">
        <h4 className="font-semibold text-slate-800 py-3 border-b border-slate-100 mb-4">Background &amp; Key Assumptions</h4>
        <div className="space-y-4 text-sm text-slate-600">

          <div>
            <p className="font-semibold text-slate-800 mb-1.5">From Performing Baseline to credit reality</p>
            <p>
              The Performing Baseline assumed every loan repaid in full at par — no defaults, full
              recovery of interest and principal (i.e. no losses). Reality is more complex. A borrower's
              ability to repay depends on two distinct factors:
            </p>
            <ul className="list-disc ml-5 mt-1.5 space-y-1.5">
              <li><strong>Cash flow:</strong> the real estate must generate sufficient operating income
              to service ongoing loan payments (interest current).</li>
              <li><strong>Collateral value:</strong> the underlying asset must be worth enough to
              repay the outstanding loan balance at maturity or enforcement.</li>
            </ul>
            <p className="mt-2">
              For simplicity, this module applies one key assumption: <strong>D-loans (&gt;100% LTV)
              are in payment default</strong> — no interest is collected while the loan is outstanding.
              All other loans are assumed to pay interest current.
            </p>
            <p className="mt-2">
              <strong>Real estate values change</strong> — they can rise or fall between origination
              and maturity.
            </p>
            <p className="mt-2">
              Where values <em>rise</em>, LTV improves: well-secured loans remain fully recoverable,
              and even impaired D-loans may see losses shrink as the asset value moves back toward the
              outstanding balance. Where values <em>fall</em>, the reverse applies: loans that appear
              well-secured today can develop collateral shortfalls at maturity.
            </p>
            <p className="mt-2">
              The most acute cases are D-loans, where principal recovery is already impaired at today's
              appraisal values — any further decline deepens the loss. If values fall materially,
              C-loans near 100% LTV and even B-loans could also face shortfalls.
            </p>
            <p className="mt-2">
              The key variable across every sub-portfolio is whether <em>forecast</em> collateral value
              at maturity covers the outstanding loan balance.
            </p>
          </div>

          <div>
            <p className="font-semibold text-slate-800 mb-1.5">Forecasting real estate value</p>
            <p>
              A comprehensive underwriting analysis would ideally forecast both (a) the{' '}
              <strong>operating cash flows</strong> the real estate generates — rents, occupancy,
              capitalisation rates — that support ongoing loan payments, and (b) the{' '}
              <strong>market value</strong> of the asset at the expected date of enforcement or maturity.
            </p>
            <p className="mt-1.5">
              Forecasting real estate cash flows is often extremely challenging in practice: borrower
              reporting is frequently out of date, incomplete, or of insufficient quality to build a
              reliable income model. This model therefore focuses on{' '}
              <strong>forecast collateral value only</strong>; detailed property-level operating cash
              flow modelling is excluded from this exercise.
            </p>
          </div>

          <div>
            <p className="font-semibold text-slate-800 mb-1.5">Appraisal basis and due diligence</p>
            <p>
              Collateral values are drawn from the <strong>borrowers' most recent independent
              appraisals</strong> as reported in the loan tape. A single annual growth rate is applied
              per geography (sub-portfolio bucket and/or state), compounded from the purchase date to
              each loan's maturity:{' '}
              <em>Forecast collateral = Appraisal &times; (1 + rate)<sup>years</sup></em>.
            </p>
            <p className="mt-1.5 text-slate-500">
              In practice, Heron would commission its own <strong>independent valuation</strong> to verify
              today's market value and project future value under base, upside, and stress scenarios 
              since borrower appraisals can be stale or optimistic. Rates are adjustable in the{' '}
              <strong>Assumptions</strong> tab; at 0%, recovery uses today's borrower appraisal values
              directly.
            </p>
          </div>

          <div>
            <p className="font-semibold text-slate-800 mb-1.5">Key Assumptions</p>
            <ul className="list-disc ml-5 space-y-1.5">
              <li>All loans are <strong>held to maturity</strong> — no early sales, cures, or enforcement (those come in Active Resolution).</li>
              <li><strong>D loans (&gt;100% LTV)</strong> are in payment default — no interest is collected by the lender.</li>
              <li>Recovery at maturity = <strong>min(outstanding loan balance, forecast collateral value)</strong>.</li>
              <li>Forecast collateral = current appraisal &times; (1 + annual rate)<sup>years</sup>, set per geography (bucket and/or state) in Assumptions.</li>
              <li>At default rates (0%), recovery uses current borrower appraisal values from the loan tape.</li>
            </ul>
          </div>

          {anyAppreciation && (
            <div className="px-3 py-1.5 bg-blue-100 border border-blue-200 rounded text-xs text-blue-800">
              <strong>Active appreciation rates:</strong>{' '}
              {Object.keys(assumptions.recoveryStateRates).length > 0
                ? Object.entries(assumptions.recoveryStateRates).map(([s, r]) => `${s} ${fmt.pct(r)}`).join(', ')
                : 'bucket rates applied — see Assumptions tab'}
            </div>
          )}
        </div>
      </div>

      {/*  Collateral & Recovery Summary Table  */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-slate-900 mb-1">Collateral &amp; Recovery Summary — by Sub-Portfolio</h3>
        <p className="text-xs text-slate-500 mb-3">
          Borrower appraisals vs. forecast recovery at maturity. Base case assumes 0% annual appreciation (today's values).
          {anyAppreciation && ' Current scenario reflects the appreciation rates set in Assumptions.'}
        </p>
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Sub-Portfolio</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Outstanding (Par)</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Borrower Appraisal</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Forecasted Value</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">LTV</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Recovery (Base 0%)</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Recovery (Forecasted)</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Expected Loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {appraisalSummary.map(row => (
                <tr key={row.rf} className={row.rf === 'D' ? 'bg-red-50/60' : 'bg-white'}>
                  <td className="px-4 py-2.5 text-xs">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${RISK_COLORS[row.rf]}`}>
                      {row.rf}
                    </span>
                    <span className="ml-2 text-slate-500">{RF_LABELS[row.rf]}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums text-slate-700">{fmt.currencyM(row.outstanding)}</td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums text-slate-700">{fmt.currencyM(row.appraisal)}</td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums text-slate-700">{fmt.currencyM(row.forecastedValue)}</td>
                  <td className={`px-4 py-2.5 text-right text-xs tabular-nums font-semibold ${row.ltv <= 1 ? 'text-green-700' : 'text-red-600'}`}>
                    {(row.ltv * 100).toFixed(0)}%
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums text-slate-700">{fmt.currencyM(row.recoveryAt0)}</td>
                  <td className="px-4 py-2.5 text-right text-xs tabular-nums text-slate-700">{fmt.currencyM(row.recoveryAtRates)}</td>
                  <td className={`px-4 py-2.5 text-right text-xs tabular-nums font-semibold ${row.lossAtRates < -1e4 ? 'text-red-600' : 'text-slate-400'}`}>
                    {row.lossAtRates < -1e4 ? fmt.currencyM(row.lossAtRates) : ''}
                  </td>
                </tr>
              ))}
              {(() => {
                const totOut = appraisalSummary.reduce((s, r) => s + r.outstanding, 0);
                const totApp = appraisalSummary.reduce((s, r) => s + r.appraisal, 0);
                const totForecast = appraisalSummary.reduce((s, r) => s + r.forecastedValue, 0);
                const totRec0 = appraisalSummary.reduce((s, r) => s + r.recoveryAt0, 0);
                const totRecR = appraisalSummary.reduce((s, r) => s + r.recoveryAtRates, 0);
                const totLoss = appraisalSummary.reduce((s, r) => s + r.lossAtRates, 0);
                const totLTV = totApp > 0 ? totOut / totApp : 0;
                return (
                  <tr className="bg-slate-100 font-semibold border-t border-slate-200">
                    <td className="px-4 py-2.5 text-xs text-slate-700">Total Portfolio</td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums">{fmt.currencyM(totOut)}</td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums">{fmt.currencyM(totApp)}</td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums">{fmt.currencyM(totForecast)}</td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums text-slate-600">
                      {(totLTV * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums">{fmt.currencyM(totRec0)}</td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums">{fmt.currencyM(totRecR)}</td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums text-red-600">{fmt.currencyM(totLoss)}</td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/*  Sub-portfolio detail cards  */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Sub-Portfolio Cash Flows</h3>
        <p className="text-xs text-slate-500 mb-3">
          Bar chart shows collateral position: Borrower Appraisal vs. Forecasted Value at maturity. LTV based on outstanding balance.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {subPortfolios.map(sp => {
            const summary = appraisalSummary.find(s => s.rf === sp.riskFactor)!;
            const appraisedLTV = summary.appraisal > 0 ? summary.outstanding / summary.appraisal : 0;
            const forecastedLTV = summary.forecastedValue > 0 ? summary.outstanding / summary.forecastedValue : 0;
            const valueChangePct = summary.appraisal > 0
              ? (summary.forecastedValue - summary.appraisal) / summary.appraisal
              : 0;
            const chartData = [
              { label: 'Appraised', value: summary.appraisal / 1e6, ltv: appraisedLTV, fill: '#3b82f6' },
              { label: 'Forecasted', value: summary.forecastedValue / 1e6, ltv: forecastedLTV, fill: RF_CHART_COLORS[sp.riskFactor] },
            ];
            return (
              <div key={sp.riskFactor} className={`rounded-xl p-4 border ${sp.riskFactor === 'D' ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
                <div className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold mb-3 ${RISK_COLORS[sp.riskFactor]}`}>
                  {sp.riskFactor} Loans
                </div>

                {/* Collateral bar chart */}
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={chartData} margin={{ top: 20, right: 6, bottom: 4, left: -4 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v.toFixed(0)}m`} axisLine={false} tickLine={false} width={52} />
                    <Tooltip
                      formatter={(v: number | undefined) => v != null ? [fmt.currencyM(v * 1e6), ''] : ''}
                      labelStyle={{ fontSize: 11, fontWeight: 600 }}
                      contentStyle={{ fontSize: 11, padding: '6px 10px' }}
                    />
                    <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                      {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      <LabelList
                        dataKey="ltv"
                        position="top"
                        formatter={(v: string | number | boolean | null | undefined) => `${(Number(v ?? 0) * 100).toFixed(0)}% LTV`}
                        style={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-1 flex justify-between text-xs">
                  <span className="text-slate-500">Value Change</span>
                  <span className={`font-semibold ${valueChangePct >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {valueChangePct >= 0 ? '+' : ''}{fmt.pct(valueChangePct)}
                  </span>
                </div>

                {/* Cash flow numbers */}
                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                  {sp.totalLosses < 0 ? (
                    <div className="flex justify-between text-xs">
                      <span className="text-red-500">Loan Losses</span>
                      <span className="font-semibold text-red-600">{fmt.currencyM(sp.totalLosses)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Loan Losses</span>
                      <span className="font-semibold text-slate-400"></span>
                    </div>
                  )}
                  {sp.riskFactor === 'D' && (
                    <p className="text-xs text-red-400 italic">No interest (payment default)</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/*  Per-Bucket Charts  */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-slate-900 mb-1">Cash Flows by Sub-Portfolio</h3>
        <p className="text-xs text-slate-500 mb-3">
          D loans: no interest (payment default). Red bars = loan losses where forecast collateral &lt; outstanding balance.
        </p>
        <div className="grid grid-cols-2 gap-4">
          {bucketChartData.map(cfg => (
            <BucketChart
              key={cfg.rf}
              data={cfg.data}
              title={cfg.label}
              showLosses
              showOutstanding
              interestColor={cfg.interestColor}
              principalColor={cfg.principalColor}
            />
          ))}
        </div>
      </div>

      {/*  Aggregate Chart  */}
      <CashFlowChart periods={periods} showLosses title="Aggregate Quarterly Cash Flows — Recovery Analysis" />

      {/*  Returns Summary  */}
      <div className="mt-8">
        <h3 className="text-base font-bold text-slate-900 mb-1">Returns — Recovery Analysis (Purchase at Par)</h3>
        <p className="text-xs text-slate-500 mb-3">
          In the Performing Baseline you were asked to export the cash flows and calculate the returns manually.
          Here, the returns are calculated for you based on par  .
        </p>
                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Scenario</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Purchase Price (Par)</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Total Loan Losses</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">IRR at Par</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">MoIC at Par</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-slate-50/40">
                <td className="px-4 py-2.5 text-sm font-semibold text-slate-700">Performing Baseline</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{fmt.currencyM(parValue)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums text-slate-400">-</td>
                <td className={`px-4 py-2.5 text-right text-sm tabular-nums font-semibold ${m1IRR >= 0.125 ? 'text-green-700' : 'text-amber-700'}`}>
                  {fmt.pct(m1IRR)}
                </td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums font-semibold text-green-700">{fmt.x(m1MoIC)}</td>
              </tr>
              <tr className="bg-amber-50/40">
                <td className="px-4 py-2.5 text-sm font-semibold text-amber-800">Recovery Analysis</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{fmt.currencyM(parValue)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums font-semibold text-red-600">{fmt.currencyM(Math.abs(totalLosses))}</td>
                <td className={`px-4 py-2.5 text-right text-sm tabular-nums font-semibold ${irrAtPar >= 0.125 ? 'text-green-700' : 'text-amber-700'}`}>
                  {fmt.pct(irrAtPar)}
                </td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums font-semibold text-green-700">{fmt.x(moicAtPar)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/*  Price Discovery  */}
      <div className="hidden mt-6 border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-700">Price Discovery — Bid Price at Target Unlevered IRR</h3>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Goal-seek</span>
        </div>
        <div className="p-5">
          <p className="text-xs text-slate-500 mb-4">
            Move the slider to see how your target IRR drives the maximum purchase price across each scenario.
            The Recovery Analysis price is the passive hold bid.
          </p>
          <div className="flex items-center gap-4 mb-5">
            <span className="text-xs font-medium text-slate-600 w-28 shrink-0">Target IRR (Unlevered)</span>
            <input
              type="range"
              min={6}
              max={20}
              step={0.5}
              value={targetIRR * 100}
              onChange={e => setTargetIRR(Number(e.target.value) / 100)}
              className="flex-1 accent-blue-700"
            />
            <span className="text-blue-700 font-bold text-xl w-20 text-right">
              {(targetIRR * 100).toFixed(1)}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Performing Baseline</p>
              <p className="text-xs text-slate-400 mb-3">All loans at par, no defaults</p>
              <p className="text-2xl font-bold text-slate-800">{fmt.currencyM(perfBaselinePrice)}</p>
              <p className="text-xs text-slate-500 mt-1">
                {fmt.pct((parValue - perfBaselinePrice) / parValue)} discount to par
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Recovery Analysis</p>
              <p className="text-xs text-amber-600 mb-3">Hold to maturity — D-loan defaults + losses</p>
              <p className="text-2xl font-bold text-amber-900">{fmt.currencyM(recoveryPrice)}</p>
              <p className="text-xs text-amber-700 mt-1">
                {fmt.pct((parValue - recoveryPrice) / parValue)} discount to par
              </p>
            </div>
          </div>
          <p className="text-xs text-amber-700 mt-3">
            Credit losses reduce bid capacity by{' '}
            <strong>{fmt.currencyM(perfBaselinePrice - recoveryPrice)}</strong>.
          </p>
        </div>
      </div>

      {/*  Table  */}
      <CashFlowTable
        periods={periods}
        showLosses
        purchasePrice={parValue}
        exportLabel="M3_RecoveryAnalysis"
      />

      {/*  Questions  */}
      <div className="mt-6 mb-6">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Questions</h3>
        <p className="text-sm text-slate-500 mb-6">
          Focus on floor logic and downside channels in the recovery framework.
        </p>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <QuestionBlock num="Q1" title="Recovery Shortfall and Bid Capacity">
            <TextAnswerInput
              questionId="ra_q_floor_definition"
              module="m3"
              label="In plain terms, what is a recovery shortfall (when collateral does not fully cover loan balance), and why does that directly reduce the maximum price you can bid?"
              rows={5}
            />
          </QuestionBlock>
          <QuestionBlock num="Q2" title="Value Cycle Assumptions">
            <TextAnswerInput
              questionId="ra_q_worse_than_floor"
              module="m3"
              label="How does your collateral value-change assumption (rising, flat, or falling) affect forecast recovery, and how would bid/returns differ in a rising vs. falling real estate cycle?"
              rows={6}
            />
          </QuestionBlock>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={() => dispatch({ type: 'MARK_COMPLETE', module: 'm3' })}
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














