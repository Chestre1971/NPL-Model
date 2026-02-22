import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { fmt } from '../../lib/format';
import { solvePriceForXIRR, xirr } from '../../lib/irr';
import { StatCard } from '../shared/StatCard';
import { TextAnswerInput } from '../shared/AnswerInput';
import { QuestionBlock } from '../shared/QuestionBlock';
import { BucketChart } from '../shared/BucketChart';
import { CheckCircle2 } from 'lucide-react';
import { fmtMonthYear } from '../../lib/dateUtils';
import { PageShell } from '../shared/PageShell';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';

export function EnforcementView() {
  const { m1CF, recoveryCF, m3CF, assumptions, effectiveLoans, timeline, state, dispatch } = useApp();
  const isComplete = state.modules.m_enf?.completed ?? false;

  const { dEnforcement } = m3CF;
  const njTimingMonths = assumptions.m4NJResolutionMonths;
  const jTimingMonths = assumptions.m4JResolutionMonths;
  const njModelDateLabel = timeline[dEnforcement.nonJudicialPeriodIdx] ? fmtMonthYear(timeline[dEnforcement.nonJudicialPeriodIdx]) : '';
  const jModelDateLabel = timeline[dEnforcement.judicialPeriodIdx] ? fmtMonthYear(timeline[dEnforcement.judicialPeriodIdx]) : '';
  const timingGapMonths = jTimingMonths - njTimingMonths;
  const pvTimingGapPer1m = useMemo(() => {
    const pvNJ = 1_000_000 / Math.pow(1.12, njTimingMonths / 12);
    const pvJ = 1_000_000 / Math.pow(1.12, jTimingMonths / 12);
    return pvNJ - pvJ;
  }, [njTimingMonths, jTimingMonths]);
  const pvTimingGapPct = useMemo(() => {
    const pvNJ = 1_000_000 / Math.pow(1.12, njTimingMonths / 12);
    const pvJ = 1_000_000 / Math.pow(1.12, jTimingMonths / 12);
    return pvNJ > 0 ? (pvNJ - pvJ) / pvNJ : 0;
  }, [njTimingMonths, jTimingMonths]);

  const njStates = useMemo(() => {
    const states = new Set(effectiveLoans.filter(l => l.riskFactor === 'D' && l.judicial !== 'J').map(l => l.jurisdiction));
    return [...states].sort().join(' / ');
  }, [effectiveLoans]);

  const jStates = useMemo(() => {
    const states = new Set(effectiveLoans.filter(l => l.riskFactor === 'D' && l.judicial === 'J').map(l => l.jurisdiction));
    return [...states].sort().join(' / ');
  }, [effectiveLoans]);

  const dLoans = useMemo(() => effectiveLoans.filter(l => l.riskFactor === 'D'), [effectiveLoans]);
  const dBalance = useMemo(() => dLoans.reduce((s, l) => s + l.amount, 0), [dLoans]);
  const dCollateral = useMemo(() => dLoans.reduce((s, l) => s + l.collateralValue, 0), [dLoans]);

  const [targetIRR, setTargetIRR] = useState(0.125);
  const parValue = useMemo(() => effectiveLoans.reduce((s, l) => s + l.amount, 0), [effectiveLoans]);
  const legalDDRate = assumptions.m2LegalDDRate;
  const ldd = 1 + legalDDRate;
  const purchaseAtPar = parValue * ldd;

  const nonDRecoveryPeriodic = useMemo(() => {
    const n = timeline.length;
    const cash = new Array(n).fill(0);
    recoveryCF.subPortfolios
      .filter(sp => sp.riskFactor !== 'D')
      .forEach(sp => {
        sp.periods.forEach((p, i) => {
          cash[i] += p.interestPayment + p.principalRepayment + p.loanLosses;
        });
      });
    return cash;
  }, [recoveryCF.subPortfolios, timeline.length]);
  const enforcementCashAtPar = useMemo(() => {
    const n = timeline.length;
    const cash = new Array(n).fill(0);
    cash[0] = -purchaseAtPar;
    for (let i = 1; i < n; i++) {
      cash[i] = nonDRecoveryPeriodic[i] + (dEnforcement.periodicCash[i] ?? 0);
    }
    return cash;
  }, [timeline.length, purchaseAtPar, nonDRecoveryPeriodic, dEnforcement.periodicCash]);

  const perfBaselinePrice = useMemo(
    () => solvePriceForXIRR(targetIRR, m1CF.cashflows.slice(1), timeline) / ldd,
    [targetIRR, m1CF.cashflows, timeline, ldd],
  );

  const recoveryPrice = useMemo(
    () => solvePriceForXIRR(targetIRR, recoveryCF.cashflows.slice(1), timeline) / ldd,
    [targetIRR, recoveryCF.cashflows, timeline, ldd],
  );

  const enforcementPrice = useMemo(
    () => solvePriceForXIRR(targetIRR, enforcementCashAtPar.slice(1), timeline) / ldd,
    [targetIRR, enforcementCashAtPar, timeline, ldd],
  );

  
  const baselineCashAtBid = useMemo(() => {
    const cfs = [...m1CF.cashflows];
    cfs[0] = -(perfBaselinePrice * ldd);
    return cfs;
  }, [m1CF.cashflows, perfBaselinePrice, ldd]);

  const recoveryCashAtBid = useMemo(() => {
    const cfs = [...recoveryCF.cashflows];
    cfs[0] = -(recoveryPrice * ldd);
    return cfs;
  }, [recoveryCF.cashflows, recoveryPrice, ldd]);

  const enforcementCashAtBid = useMemo(() => {
    const cfs = [...enforcementCashAtPar];
    cfs[0] = -(enforcementPrice * ldd);
    return cfs;
  }, [enforcementCashAtPar, enforcementPrice, ldd]);

  const baselineIRRAtBid = useMemo(() => xirr(baselineCashAtBid, timeline), [baselineCashAtBid, timeline]);
  const recoveryIRRAtBid = useMemo(() => xirr(recoveryCashAtBid, timeline), [recoveryCashAtBid, timeline]);
  const enforcementIRRAtBid = useMemo(() => xirr(enforcementCashAtBid, timeline), [enforcementCashAtBid, timeline]);

  const baselineMoICAtBid = useMemo(() => {
    const inflows = baselineCashAtBid.slice(1).reduce((s, v) => s + v, 0);
    return perfBaselinePrice > 0 ? inflows / (perfBaselinePrice * ldd) : 0;
  }, [baselineCashAtBid, perfBaselinePrice, ldd]);

  const recoveryMoICAtBid = useMemo(() => {
    const inflows = recoveryCashAtBid.slice(1).reduce((s, v) => s + v, 0);
    return recoveryPrice > 0 ? inflows / (recoveryPrice * ldd) : 0;
  }, [recoveryCashAtBid, recoveryPrice, ldd]);

  const enforcementMoICAtBid = useMemo(() => {
    const inflows = enforcementCashAtBid.slice(1).reduce((s, v) => s + v, 0);
    return enforcementPrice > 0 ? inflows / (enforcementPrice * ldd) : 0;
  }, [enforcementCashAtBid, enforcementPrice, ldd]);

  const totalReturnBaselineBid = useMemo(() => baselineCashAtBid.reduce((s, v) => s + v, 0), [baselineCashAtBid]);
  const totalReturnRecoveryBid = useMemo(() => recoveryCashAtBid.reduce((s, v) => s + v, 0), [recoveryCashAtBid]);
  const totalReturnEnforcementBid = useMemo(() => enforcementCashAtBid.reduce((s, v) => s + v, 0), [enforcementCashAtBid]);

  const dPassiveData = useMemo(() => {
    const dSp = recoveryCF.subPortfolios.find(sp => sp.riskFactor === 'D');
    if (!dSp) return [];
    let outstanding = dBalance;
    return dSp.periods
      .map((p, idx) => ({ p, period: recoveryCF.periods[idx] }))
      .filter(({ period }) => period.periodIdx === 0 || period.isIPD)
      .map(({ p, period }) => {
        const row = {
          name: period.label,
          interest: p.interestPayment,
          principal: p.principalRepayment,
          losses: p.loanLosses,
          outstanding: Math.max(0, outstanding) / 1e6,
        };
        outstanding -= p.principalRepayment;
        return row;
      });
  }, [recoveryCF.subPortfolios, recoveryCF.periods, dBalance]);

  const dActiveOutstanding = useMemo(() => {
    const out = new Array(timeline.length).fill(0);
    for (const loan of dLoans) {
      const resolveIdx = loan.judicial === 'J' ? dEnforcement.judicialPeriodIdx : dEnforcement.nonJudicialPeriodIdx;
      // Outstanding is treated as written off/resolved at the enforcement period itself.
      // Keep balance only up to the period immediately before resolution.
      for (let i = 0; i < resolveIdx && i < timeline.length; i++) out[i] += loan.amount;
    }
    return out;
  }, [dLoans, dEnforcement.judicialPeriodIdx, dEnforcement.nonJudicialPeriodIdx, timeline.length]);

  const dEnforcementData = useMemo(() => {
    const grossByPeriod = new Array(timeline.length).fill(0);
    const costByPeriod = new Array(timeline.length).fill(0);
    const creditLossByPeriod = new Array(timeline.length).fill(0);
    const principalRecoveryByPeriod = new Array(timeline.length).fill(0);

    for (const loan of dLoans) {
      const idx = loan.judicial === 'J' ? dEnforcement.judicialPeriodIdx : dEnforcement.nonJudicialPeriodIdx;
      const costRate = loan.judicial === 'J' ? assumptions.m4JForceCostRate : assumptions.m4NJForceCostRate;
      const gross = loan.enforcementRecovery;
      const costs = loan.amount * costRate;
      const creditLoss = Math.max(0, loan.amount - gross);
      const principalRecovery = Math.max(0, gross - costs);
      grossByPeriod[idx] += gross;
      costByPeriod[idx] += costs;
      creditLossByPeriod[idx] += creditLoss;
      principalRecoveryByPeriod[idx] += principalRecovery;
    }

    return m3CF.periods
      .filter(p => p.periodIdx === 0 || p.isIPD)
      .map(p => {
        return {
          name: p.label,
          interest: grossByPeriod[p.periodIdx] ?? 0,
          principal: principalRecoveryByPeriod[p.periodIdx] ?? 0,
          losses: -(creditLossByPeriod[p.periodIdx] ?? 0),
          extraCosts: -(costByPeriod[p.periodIdx] ?? 0),
          outstanding: Math.max(0, dActiveOutstanding[p.periodIdx]) / 1e6,
        };
      });
  }, [m3CF.periods, dActiveOutstanding, timeline.length, dLoans, dEnforcement.judicialPeriodIdx, dEnforcement.nonJudicialPeriodIdx, assumptions.m4JForceCostRate, assumptions.m4NJForceCostRate]);

  const dStackMax = Math.max(
    0,
    ...dPassiveData.map(d => (d.interest || 0) + (d.principal || 0)),
    ...dEnforcementData.map(d => (d.interest || 0) + (d.principal || 0)),
  );
  const dMin = Math.min(
    0,
    ...dPassiveData.map(d => d.losses || 0),
    ...dEnforcementData.map(d => d.losses || 0),
  );
  const dYAxisDomain: [number, number] = [dMin, dStackMax * 1.08];
  const dOutAxisMax = Math.max(
    0,
    ...dPassiveData.map(d => d.outstanding || 0),
    ...dEnforcementData.map(d => d.outstanding || 0),
  ) * 1.08;

  return (
    <PageShell>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Enforcement</h2>
        <p className="text-slate-500 text-sm mt-1">
          D-loan resolution — the coercive floor that defines minimum recovery
        </p>
      </div>

      {/*  Background & Instructions  */}
      <div className="border border-slate-200 rounded-xl mb-5 px-4 pb-4">
        <h4 className="font-semibold text-slate-800 py-3 border-b border-slate-100 mb-4">Background &amp; Instructions</h4>
        <div className="space-y-4 text-sm text-slate-600">

                    <div>
                        <p className="font-semibold text-slate-800 mb-1.5">From Recovery Analysis to Enforcement</p>
            <p>
              The Recovery Analysis established the <strong>passive floor</strong>: what Heron earns
              if it buys the portfolio, does nothing, and waits for loans to mature. D-loans
              (&gt;100% LTV) drove the bulk of losses in that scenario - collateral was insufficient
              to repay the full balance, and no interest income was received during the hold period.
            </p>
            <p className="mt-2">
              It makes a massive assumption: all borrowers are going to either repay the loans in line
              with collateral values at the time of maturity, or they are going to sell the assets and
              remit the proceeds to the lender in lieu of the loan. The reality is that the majority
              of borrowers are not going to take any action unless forced.
            </p>
            <p className="mt-2">
              This module examines what happens when Heron <strong>takes active legal action</strong>
              against D-loan borrowers: enforcement, foreclosure, and sale of the asset. With no equity
              to protect, borrowers have minimal incentive to co-operate voluntarily. Heron must enforce
              to realise whatever collateral value remains.
            </p>
            <p className="mt-2">
              Understanding enforcement mechanics is fundamental to NPL underwriting because:
            </p>
            <ul className="list-disc ml-5 mt-1.5 space-y-1.5">
              <li>The <strong>timeline to proceeds</strong> depends entirely on jurisdiction - non-judicial vs. judicial states create materially different cash flow timings.</li>
              <li>The <strong>cost of enforcement</strong> (legal fees, carrying costs, REO disposal) reduces net recovery below gross collateral value.</li>
              <li>The <strong>absence of income</strong> during the enforcement period means every additional month of delay has a direct, compounding effect on Heron's returns.</li>
              <li>Enforcement therefore sets the <strong>coercive floor</strong> for D-loan negotiations - all other strategies (deed-in-lieu, restructured DPO) are evaluated against what Heron could receive through full enforcement.</li>
            </ul>
          </div>

                    <div>
                        <p className="font-semibold text-slate-800 mb-1.5">Key Assumptions</p>
            <ul className="list-disc ml-5 space-y-1.5">
              <li>D Loans (&gt;100% LTV) are in <strong>payment default</strong> - no interest is collected during the enforcement period.</li>
              <li>Recovery at enforcement = <strong>collateral value x (1 - enforcement cost rate)</strong>.</li>
              <li>Enforcement costs: <strong>{fmt.pct(assumptions.m4NJForceCostRate)}</strong> (non-judicial) / <strong>{fmt.pct(assumptions.m4JForceCostRate)}</strong> (judicial) - adjustable in the Assumptions tab.</li>
              <li>Non-judicial states (<strong>{njStates || 'NJ states'}</strong>): proceeds received at <strong>T+{njTimingMonths} ({njModelDateLabel})</strong>.</li>
              <li>Judicial states (<strong>{jStates || 'J states'}</strong>): proceeds received at <strong>T+{jTimingMonths} ({jModelDateLabel})</strong>.</li>
              <li>Collateral values are from current borrower appraisals (0% appreciation assumption).</li>
            </ul>
            <p className="mt-2">
              In reality, each loan would need to be assessed. Depending on security enforceability,
              and the status of default and/or notice of default, each loan would be assigned its own
              workout period to proceeds.
            </p>
          </div>
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            <strong>Note:</strong> This module does not assume enforcement for other loan classes.
            In practice, if a structured resolution cannot be reached and alternatives to accelerate repayment
            are limited, enforcement may also need to be underwritten. That is usually assessed on a
            loan-by-loan basis using security enforceability and borrower default status. For this assignment,
            treatment is simplified at the risk-bucket level rather than fully individualized by loan.
          </div>
        </div>
      </div>

      {/*  D-loan sub-portfolio summary  */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-slate-900 mb-3">D-Loan Sub-Portfolio — Current Position</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="D-Loan Count" value={dLoans.length.toString()} />
          <StatCard label="Outstanding Balance" value={fmt.currencyM(dBalance)} />
          <StatCard label="Borrower Appraisal" value={fmt.currencyM(dCollateral)} />
          <StatCard label="Collateral Shortfall" value={fmt.currencyM(dBalance - dCollateral)} color="red"
            sub="balance ÷ appraisal" />
        </div>
      </div>

      {/*  Enforcement process  */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-slate-900 mb-3">The Enforcement Process</h3>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide">
            From Notice of Default to proceeds — step by step
          </p>
          <div className="space-y-4 text-sm">
            {[
              {
                step: '1',
                title: 'Notice of Default (month 0)',
                body: 'Heron issues a formal Notice of Default as new lender of record. D-loan borrowers have a cure window (30-90 days). At >100% LTV the borrower has negative equity - there is nothing to protect, so cure is economically irrational. Borrowers are assumed not to cure.',
              },
              {
                step: '2',
                title: 'Legal process - jurisdiction determines timeline',
                body: `Non-judicial (${njStates || 'NJ states'}): a trustee-led, out-of-court process. No lawsuit required. Typically 9-18 months from notice to auction (model uses T+${njTimingMonths}, ${njModelDateLabel}). Judicial (${jStates || 'J states'}): Heron files a lawsuit in state court. Subject to court scheduling, borrower motions to delay, systemic court backlogs, and mandatory redemption periods (model uses T+${jTimingMonths}, ${jModelDateLabel}).`,
              },
              {
                step: '3',
                title: 'Taking title - REO',
                body: "Court issues a judgment (judicial) or the trustee's deed is recorded (non-judicial). If no third-party buyer bids above the outstanding balance at auction, Heron takes title to the Real Estate Owned (REO). This is common for D-loans where collateral is already below balance.",
              },
              {
                step: '4',
                title: 'REO sale - net proceeds',
                body: `Heron markets and disposes of the REO asset. Net proceeds = collateral value less enforcement costs (${fmt.pct(assumptions.m4NJForceCostRate)} NJ / ${fmt.pct(assumptions.m4JForceCostRate)} judicial of outstanding principal). This is the cash inflow modelled in the Enforcement scenario.`,
              },
            ].map(s => (
              <div key={s.step} className="flex gap-3 text-slate-700">
                <span className="font-bold text-slate-400 shrink-0 w-4 text-center">{s.step}</span>
                <div>
                  <p className="font-semibold mb-0.5">{s.title}</p>
                  <p className="text-slate-600">{s.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* NJ vs Judicial timing cards */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            {njStates && (
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-slate-700 mb-1">Non-Judicial ({njStates})</p>
                <p className="text-2xl font-bold text-slate-900">~9-18 months</p>
                <p className="text-sm text-slate-600 mt-0.5">Model: T+{njTimingMonths} - <strong>{njModelDateLabel}</strong></p>
                <p className="text-sm text-slate-600 mt-2">Trustee-led; no court required. Lower legal cost, faster proceeds. Heron receives proceeds ~{Math.abs(timingGapMonths)} months ahead of judicial track.</p>
                <p className="text-sm text-slate-700 mt-1.5 font-medium">
                  Enforcement cost: {fmt.pct(assumptions.m4NJForceCostRate)} of principal
                </p>
              </div>
            )}
            {jStates && (
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-slate-700 mb-1">Judicial ({jStates})</p>
                <p className="text-2xl font-bold text-slate-900">~24-48 months</p>
                <p className="text-sm text-slate-600 mt-0.5">Model: T+{jTimingMonths} - <strong>{jModelDateLabel}</strong></p>
                <p className="text-sm text-slate-600 mt-2">Court proceedings required. NY/PA systemic backlogs create significant delay risk. Borrower motions can extend timeline further.</p>
                <p className="text-sm text-slate-700 mt-1.5 font-medium">
                  Enforcement cost: {fmt.pct(assumptions.m4JForceCostRate)} of principal
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 p-3 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700">
            <strong>PV impact of timing gap ({timingGapMonths} months):</strong> At a 12% hurdle rate, $1m received at T+{jTimingMonths} is worth
            approximately {fmt.currencyM(Math.abs(pvTimingGapPer1m))} less than the same $1m received at T+{njTimingMonths}
            {' '}({fmt.pct(Math.abs(pvTimingGapPct))} reduction per dollar of recovery).
            Across the portfolio's judicial D-loan balance, this timing gap is one of the most significant return
            drivers in the entire underwriting model.
          </div>
        </div>
      </div>

      {/*  Recovery stats  */}
      <div className="mb-6">
        <h3 className="text-base font-bold text-slate-900 mb-3">Enforcement Recovery — by Jurisdiction</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard
            label={`Non-Judicial Recovery${njStates ? ` (${njStates})` : ''}`}
            value={fmt.currencyM(dEnforcement.nonJudicialRecovery)}
            sub={`Costs: ${fmt.currencyM(dEnforcement.nonJudicialCosts)}`}
          />
          <StatCard
            label={`Judicial Recovery${jStates ? ` (${jStates})` : ''}`}
            value={fmt.currencyM(dEnforcement.judicialRecovery)}
            sub={`Costs: ${fmt.currencyM(dEnforcement.judicialCosts)}`}
          />
          <StatCard
            label="Net Recovery (Total)"
            value={fmt.currencyM(dEnforcement.totalNetRecovery)}
            color="blue"
          />
          <StatCard
            label="Total Enforcement Costs"
            value={fmt.currencyM(dEnforcement.nonJudicialCosts + dEnforcement.judicialCosts)}
            color="red"
          />
        </div>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
          Non-judicial{njStates ? ` (${njStates})` : ''}: proceeds at{' '}
          {timeline[dEnforcement.nonJudicialPeriodIdx] ? fmtMonthYear(timeline[dEnforcement.nonJudicialPeriodIdx]) : ''} 
          Judicial{jStates ? ` (${jStates})` : ''}: proceeds at{' '}
          {timeline[dEnforcement.judicialPeriodIdx] ? fmtMonthYear(timeline[dEnforcement.judicialPeriodIdx]) : ''}
        </div>
      </div>

      {/*  Chart: recovery vs costs  */}
      <div className="mb-8">
        <h3 className="text-sm font-semibold text-slate-600 mb-3">D-Loan Recovery Stack by Jurisdiction (Pre-Enforcement Value + Enforcement Costs)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={[
              {
                name: `Non-Judicial${njStates ? ` (${njStates})` : ''}\n${timeline[dEnforcement.nonJudicialPeriodIdx] ? fmtMonthYear(timeline[dEnforcement.nonJudicialPeriodIdx]) : ''}`,
                'Gross Recovery': dEnforcement.nonJudicialRecovery / 1e6,
                'Enforcement Costs': dEnforcement.nonJudicialCosts / 1e6,
              },
              {
                name: `Judicial${jStates ? ` (${jStates})` : ''}\n${timeline[dEnforcement.judicialPeriodIdx] ? fmtMonthYear(timeline[dEnforcement.judicialPeriodIdx]) : ''}`,
                'Gross Recovery': dEnforcement.judicialRecovery / 1e6,
                'Enforcement Costs': dEnforcement.judicialCosts / 1e6,
              },
            ]}
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={v => `$${(v as number).toFixed(0)}m`} tick={{ fontSize: 10 }} width={58} />
            <Tooltip formatter={(v: number | undefined) => v != null ? `$${v.toFixed(1)}m` : ''} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Gross Recovery" fill="#1e3a5f" name="Pre-Enforcement Value" stackId="recovery" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Enforcement Costs" fill="#ef4444" name="Enforcement Costs" stackId="recovery" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-8">
        <h3 className="text-base font-bold text-slate-900 mb-1">D Loans - Passive Hold vs Enforcement</h3>
        <p className="text-sm text-slate-500 mb-4">
          Left: Recovery Analysis passive hold. Right: Enforcement cash flows used in this module.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <BucketChart
            data={dPassiveData}
            title="D Loans - Passive Hold"
            showLosses
            showOutstanding
            interestColor="#f87171"
            principalColor="#b91c1c"
            yAxisDomain={dYAxisDomain}
            outAxisMax={dOutAxisMax}
          />
          <BucketChart
            data={dEnforcementData}
            title="D Loans - Enforcement"
            showInterest
            showLosses
            showExtraCosts
            showOutstanding
            interestLabel="Value (Pre-Cost)"
            principalLabel="Principal Recovery"
            lossesLabel="Credit Loss"
            extraCostsLabel="Enforcement Costs"
            interestColor="#f59e0b"
            principalColor="#b91c1c"
            extraCostsColor="#ef4444"
            yAxisDomain={dYAxisDomain}
            outAxisMax={dOutAxisMax}
          />
        </div>
        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
          <strong>Note:</strong> On enforcement, lender losses are recognized through credit loss and enforcement-cost write-downs.
          Outstanding loan balance is then treated as resolved and floored at zero - no negative loan balances are carried.
        </div>
      </div>

      {/* Returns + Price Discovery */}
      <div className="mb-8">
        <h3 className="text-base font-bold text-slate-900 mb-1">Returns — Enforcement (Live at Bid Price)</h3>
        <p className="text-xs text-slate-500 mb-3">
          This table updates live with the slider. Purchase price, total returns, IRR, and MoIC are shown at the current bid price for each scenario.
        </p>
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white mb-6">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Scenario</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Purchase Price (Bid)</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Total Returns (Bid)</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">IRR at Bid</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">MoIC at Bid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-slate-50/40">
                <td className="px-4 py-2.5 text-sm font-semibold text-slate-700">Performing Baseline</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{fmt.currencyM(perfBaselinePrice)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums text-slate-700">{fmt.currencyM(totalReturnBaselineBid)}</td>
                <td className={`px-4 py-2.5 text-right text-sm tabular-nums font-semibold ${baselineIRRAtBid >= 0.125 ? 'text-green-700' : 'text-amber-700'}`}>{fmt.pct(baselineIRRAtBid)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums font-semibold text-green-700">{fmt.x(baselineMoICAtBid)}</td>
              </tr>
              <tr className="bg-amber-50/40">
                <td className="px-4 py-2.5 text-sm font-semibold text-amber-800">Recovery Analysis</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{fmt.currencyM(recoveryPrice)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums text-slate-700">{fmt.currencyM(totalReturnRecoveryBid)}</td>
                <td className={`px-4 py-2.5 text-right text-sm tabular-nums font-semibold ${recoveryIRRAtBid >= 0.125 ? 'text-green-700' : 'text-amber-700'}`}>{fmt.pct(recoveryIRRAtBid)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums font-semibold text-green-700">{fmt.x(recoveryMoICAtBid)}</td>
              </tr>
              <tr className="bg-blue-50/40">
                <td className="px-4 py-2.5 text-sm font-semibold text-blue-800">Enforcement Scenario</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums">{fmt.currencyM(enforcementPrice)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums font-semibold text-blue-800">{fmt.currencyM(totalReturnEnforcementBid)}</td>
                <td className={`px-4 py-2.5 text-right text-sm tabular-nums font-semibold ${enforcementIRRAtBid >= 0.125 ? 'text-green-700' : 'text-amber-700'}`}>{fmt.pct(enforcementIRRAtBid)}</td>
                <td className="px-4 py-2.5 text-right text-sm tabular-nums font-semibold text-green-700">{fmt.x(enforcementMoICAtBid)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-700">Price Discovery — Bid Price at Target Unlevered IRR</h3>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Goal-seek</span>
          </div>
          <div className="p-5">
            <p className="text-xs text-slate-500 mb-4">
              Move the slider to compare maximum purchase price across Performing Baseline, Recovery Analysis, and Enforcement.
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Performing Baseline</p>
                <p className="text-xs text-slate-400 mb-3">All loans at par, no defaults</p>
                <p className="text-2xl font-bold text-slate-800">{fmt.currencyM(perfBaselinePrice)}</p>
                <p className="text-xs text-slate-500 mt-1">{fmt.pct((parValue - perfBaselinePrice) / parValue)} discount to par</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Recovery Analysis</p>
                <p className="text-xs text-amber-600 mb-3">Passive hold to maturity</p>
                <p className="text-2xl font-bold text-amber-900">{fmt.currencyM(recoveryPrice)}</p>
                <p className="text-xs text-amber-700 mt-1">{fmt.pct((parValue - recoveryPrice) / parValue)} discount to par</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-0.5">Enforcement Scenario</p>
                <p className="text-xs text-blue-600 mb-3">D-loans resolved through enforcement</p>
                <p className="text-2xl font-bold text-blue-900">{fmt.currencyM(enforcementPrice)}</p>
                <p className="text-xs text-blue-700 mt-1">{fmt.pct((parValue - enforcementPrice) / parValue)} discount to par</p>
              </div>
            </div>
            <p className="text-xs text-blue-700 mt-3">
              Enforcement changes bid capacity by <strong>{fmt.currencyM(enforcementPrice - recoveryPrice)}</strong> versus passive Recovery.
            </p>
          </div>
        </div>
      </div>
      {/* Questions */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Questions</h3>
        <p className="text-sm text-slate-500 mb-6">
          Use outputs above and run the indicated sensitivity in Assumptions.
        </p>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <QuestionBlock num="Q1" title="Why D-Loans Need Enforcement">
            <TextAnswerInput
              questionId="enf_q_cost_timing_bid"
              module="m_enf"
              label="Why do D-loans often require enforcement to resolve? In this scenario, what incentives (or lack of incentives) does the borrower have?"
              rows={6}
            />
          </QuestionBlock>
          <QuestionBlock num="Q2" title="Enforcement as Floor Case">
            <TextAnswerInput
              questionId="enf_q_delay_d_vs_a"
              module="m_enf"
              label="Why is enforcement treated as the base-case / worst-case path for D-loans, and why does it provide a floor starting point when setting the portfolio bid?"
              rows={5}
            />
          </QuestionBlock>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={() => dispatch({ type: 'MARK_COMPLETE', module: 'm_enf' })}
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




























