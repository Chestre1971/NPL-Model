/**
 * Centralised Assumptions Panel
 * Surfaces all configurable model parameters in one place.
 * Values are stored per-module in AppState and shared via SharedAssumptions.
 */
import { useApp } from '../../context/AppContext';
import { AssumptionInput } from '../shared/AssumptionInput';
import { fmt } from '../../lib/format';
import { isIPD, fmtMonthYear, lastDayOfMonth } from '../../lib/dateUtils';

/** Dropdown for period-index assumptions (timeline IPD quarters only). */
function PeriodSelect({
  module,
  assumptionKey,
  label,
  defaultValue,
}: {
  module: 'm4';
  assumptionKey: string;
  label: string;
  defaultValue: number;
}) {
  const { state, dispatch, timeline } = useApp();
  const value = state.modules[module].assumptions[assumptionKey] ?? defaultValue;
  const ipds = timeline.map((d, i) => ({ i, d })).filter(({ i, d }) => i > 0 && isIPD(d));

  return (
    <div className="flex items-center gap-3 mb-2">
      <label className="text-sm text-slate-600 w-52">{label}</label>
      <select
        value={value}
        onChange={e =>
          dispatch({
            type: 'SET_MODULE_ASSUMPTIONS',
            module,
            assumptions: { [assumptionKey]: parseInt(e.target.value, 10) },
          })
        }
        className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        {ipds.map(({ i, d }) => (
          <option key={i} value={i}>
            {fmtMonthYear(d)}
          </option>
        ))}
      </select>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-4 bg-white border border-slate-200 rounded-xl shadow-sm mb-4 ${className ?? ''}`}>
      {children}
    </div>
  );
}

/** Compact stacked label-above-input cell, always pct format, for grid layouts. */
function CompactPctInput({ module, assumptionKey, label, defaultValue }: {
  module: 'm3';
  assumptionKey: string;
  label: string;
  defaultValue: number;
}) {
  const { state, dispatch } = useApp();
  const value = state.modules[module]?.assumptions?.[assumptionKey] ?? defaultValue;
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-500 leading-tight">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={(value * 100).toFixed(2)}
          onChange={e => {
            const n = parseFloat(e.target.value);
            if (!isNaN(n)) dispatch({ type: 'SET_MODULE_ASSUMPTIONS', module, assumptions: { [assumptionKey]: n / 100 } });
          }}
          step={1}
          min={-20}
          max={20}
          className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400 text-right"
        />
        <span className="text-xs text-slate-400">%</span>
      </div>
    </div>
  );
}

const STATE_RATE_DEFAULTS: Record<string, number> = {
  California: 0.04,
  'New Hampshire': 0.02,
  'New York': 0.01,
  Pennsylvania: -0.05,
};

export function AssumptionsView() {
  const { assumptions, m1PriceAt12pct, recoveryPriceAt12pct, timeline, effectiveLoans, state, dispatch } = useApp();
  const qLabel = (idx: number) => timeline[idx] ? fmtMonthYear(timeline[idx]) : `T+${idx}`;
  const enforcementDateLabel = (monthsFromClose: number) => {
    const acq = timeline[0];
    if (!acq) return '';
    const totalMonths = acq.getUTCFullYear() * 12 + acq.getUTCMonth() + monthsFromClose;
    const dt = lastDayOfMonth(Math.floor(totalMonths / 12), (totalMonths % 12) + 1);
    return fmtMonthYear(dt);
  };
  const uniqueStates = [...new Set(effectiveLoans.map(l => l.jurisdiction))].sort();
  const parValue = effectiveLoans.reduce((s, l) => s + l.amount, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Model Assumptions</h2>
        <p className="text-slate-500 text-sm mt-1">
          All configurable parameters in one place. Changes here propagate through all modules instantly.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/*  Acquisition  */}
        <Card>
          <SectionHeader
            title="Acquisition"
            subtitle="Purchase price is set by the bid workflow, with an option below to reset to Par."
          />
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-slate-600">Purchase Price (Derived)</label>
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-slate-800">{fmt.currencyM(assumptions.m2PurchasePrice)}</div>
              <button
                type="button"
                onClick={() => dispatch({ type: 'SET_MODULE_ASSUMPTIONS', module: 'm2', assumptions: { purchasePrice: parValue } })}
                className="px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Set to Par
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Set by student bid selection in the pricing workflow. This value feeds downstream modules as the working bid.
          </p>
          <AssumptionInput
            module="m3"
            assumptionKey="legalDDRate"
            label="Legal DD / Closing Cost (%)"
            defaultValue={0.005}
            format="pct"
            step={0.05}
            min={0}
            max={5}
          />
          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-500">
            <span>12% price (Performing): <strong>{fmt.currencyM(m1PriceAt12pct)}</strong></span>
            <span>12% price (Recovery): <strong>{fmt.currencyM(recoveryPriceAt12pct)}</strong></span>
          </div>
        </Card>

        {/*  Portfolio Management  */}
        <Card>
          <SectionHeader
            title="Portfolio Management"
            subtitle="Applied to Recovery Analysis and all subsequent modules as a quarterly drag on returns."
          />
          <AssumptionInput
            module="m4"
            assumptionKey="servicerFeeRate"
            label="Annual Servicer / AM Fee (% UPB)"
            defaultValue={0.005}
            format="pct"
            step={0.05}
            min={0}
            max={5}
          />
          <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-500">
            Market rate: 0.5-2.5% p.a. of outstanding UPB depending on portfolio complexity.
            Applied quarterly at each IPD from Recovery Analysis onwards.
          </div>
        </Card>

        {/*  A Loans  */}
        <Card>
          <SectionHeader
            title="A Loans - Sub-Portfolio Sale"
            subtitle="Performing loans sold at effective yield. Earlier sale = higher IRR, potentially lower MoIC."
          />
          <PeriodSelect
            module="m4"
            assumptionKey="aSalePeriodIdx"
            label="Sale Date"
            defaultValue={3}
          />
          <AssumptionInput
            module="m4"
            assumptionKey="aSaleYield60"
            label="Portfolio A Yield (<=60% LTV)"
            defaultValue={0.06}
            format="pct"
            step={0.05}
            min={0}
            max={25}
          />
          <AssumptionInput
            module="m4"
            assumptionKey="aSaleYield65"
            label="Portfolio B Yield (<=65% LTV)"
            defaultValue={0.0625}
            format="pct"
            step={0.05}
            min={0}
            max={25}
          />
          <AssumptionInput
            module="m4"
            assumptionKey="aSaleYield70"
            label="Portfolio C Yield (<=70% LTV)"
            defaultValue={0.0675}
            format="pct"
            step={0.05}
            min={0}
            max={25}
          />
          <div className="mt-2 text-xs text-slate-500">
            Currently: <strong>{qLabel(assumptions.m3ASalePeriodIdx)}</strong>
            {' '} - portfolio sold at effective yields
            {' '}<strong>{fmt.pct(assumptions.m3ASaleYield60)}</strong> /
            {' '}<strong>{fmt.pct(assumptions.m3ASaleYield65)}</strong> /
            {' '}<strong>{fmt.pct(assumptions.m3ASaleYield70)}</strong> by LTV cutoff.
          </div>
        </Card>

        {/*  B Loans  */}
        <Card>
          <SectionHeader
            title="B Loans - Cure & Re-performing Sale"
            subtitle="Borrowers cure at aSalePeriodIdx quarter; re-performing sale at selected sale quarter."
          />
          <PeriodSelect
            module="m4"
            assumptionKey="bSalePeriodIdx"
            label="Re-performing Sale Date"
            defaultValue={9}
          />
          <AssumptionInput
            module="m4"
            assumptionKey="bReperformingSaleYield"
            label="Re-performing Sale Yield"
            defaultValue={0.08}
            format="pct"
            step={0.05}
            min={0}
            max={25}
          />
          <div className="mt-2 text-xs text-slate-500">
            Currently: <strong>{qLabel(assumptions.m3BSalePeriodIdx)}</strong>
            {' '} - re-performing portfolio sold at <strong>{fmt.pct(assumptions.m3BReperformingSaleYield)}</strong> yield.
          </div>
        </Card>

        {/*  C Loans  */}
        <Card>
          <SectionHeader
            title="C Loans - Discounted Payoff (DPO)"
            subtitle="Loans at 86-100% LTV resolved via Discounted Payoff. Loans maturing before DPO date repay at par."
          />
          <PeriodSelect
            module="m4"
            assumptionKey="dpoPeriodIdx"
            label="DPO Date"
            defaultValue={12}
          />
          <AssumptionInput
            module="m3"
            assumptionKey="dpoInterestDiscountRate"
            label="DPO Interest Discount Rate"
            defaultValue={0.09}
            format="pct"
            step={1}
            min={0}
            max={50}
          />
          <AssumptionInput
            module="m3"
            assumptionKey="dpoPrincipalDiscountRate"
            label="DPO Principal Discount Rate"
            defaultValue={0.09}
            format="pct"
            step={1}
            min={0}
            max={50}
          />
          <div className="mt-2 text-xs text-slate-500">
            Currently: <strong>{qLabel(assumptions.m3DPOPeriodIdx)}</strong>
            {' '} - interest discounted at <strong>{fmt.pct(assumptions.m3DPOInterestDiscountRate)}</strong>,
            principal at <strong>{fmt.pct(assumptions.m3DPOPrincipalDiscountRate)}</strong>.
          </div>
        </Card>

        {/*  D Loans  */}
        <Card>
          <SectionHeader
            title="D Loans - Enforcement Costs"
            subtitle="Foreclosure costs as % of principal. States classified automatically from loan tape jurisdiction."
          />
          <AssumptionInput
            module="m4"
            assumptionKey="njResolutionMonths"
            label="Non-Judicial Timing (months)"
            defaultValue={18}
            format="number"
            step={1}
            min={1}
            max={120}
          />
          <AssumptionInput
            module="m4"
            assumptionKey="jResolutionMonths"
            label="Judicial Timing (months)"
            defaultValue={36}
            format="number"
            step={1}
            min={1}
            max={120}
          />
          <AssumptionInput
            module="m4"
            assumptionKey="njForceCostRate"
            label="Non-Judicial Foreclosure Cost"
            defaultValue={0.08}
            format="pct"
            step={1}
            min={0}
            max={50}
          />
          <AssumptionInput
            module="m4"
            assumptionKey="jForceCostRate"
            label="Judicial Foreclosure Cost"
            defaultValue={0.15}
            format="pct"
            step={1}
            min={0}
            max={50}
          />
          <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-500">
            NJ market: ~8-12% - Judicial market: ~15-25%. States classified by jurisdiction from loan tape.
          </div>
          <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-slate-100 text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Enforcement timeline - initiation to proceeds received
            </div>
            <div className="grid grid-cols-2 divide-x divide-slate-200">
              <div className="px-3 py-2.5 text-xs text-slate-600">
                <p className="font-semibold text-slate-700 mb-0.5">Non-judicial (CA, NH)</p>
                <p className="text-base font-bold text-slate-800">~9-18 months</p>
                <p className="text-slate-500 mt-1">Model: T+{assumptions.m4NJResolutionMonths} - {enforcementDateLabel(assumptions.m4NJResolutionMonths)}</p>
                <p className="text-slate-400 mt-1">Trustee-led sale, no court required. Notice - auction - REO sale.</p>
              </div>
              <div className="px-3 py-2.5 text-xs text-slate-600">
                <p className="font-semibold text-slate-700 mb-0.5">Judicial (NY, PA)</p>
                <p className="text-base font-bold text-slate-800">~24-48 months</p>
                <p className="text-slate-500 mt-1">Model: T+{assumptions.m4JResolutionMonths} - {enforcementDateLabel(assumptions.m4JResolutionMonths)}</p>
                <p className="text-slate-400 mt-1">Court filing - judgment - REO sale. Backlogs and borrower tactics extend timeline materially.</p>
              </div>
            </div>
          </div>
        </Card>

        {/*  Loan-on-Loan Facility  */}
        <Card className="sm:col-span-2">
          <SectionHeader
            title="Loan-on-Loan (LoL) Facility"
            subtitle="Financing terms for the LoL overlay. Changes propagate to the Financing module immediately."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <div>
              <AssumptionInput
                module="m5"
                assumptionKey="lolAdvanceRate"
                label="(ii) Advance Rate (% of APP)"
                defaultValue={0.65}
                format="pct"
                step={1}
                min={0}
                max={100}
              />
              <AssumptionInput
                module="m5"
                assumptionKey="lolInterestRate"
                label="(iii) Interest Rate (p.a., fixed)"
                defaultValue={0.065}
                format="pct"
                step={0.25}
                min={0}
                max={30}
              />
              <AssumptionInput
                module="m5"
                assumptionKey="lolReleaseRate"
                label="(iv) Release Pricing (% of APP per loan)"
                defaultValue={0.70}
                format="pct"
                step={1}
                min={0}
                max={100}
              />
              <AssumptionInput
                module="m5"
                assumptionKey="lolPrepayPenaltyRate"
                label="(v) Prepayment Penalty (first 12 months)"
                defaultValue={0.01}
                format="pct"
                step={0.1}
                min={0}
                max={10}
              />
            </div>
            <div>
              <AssumptionInput
                module="m5"
                assumptionKey="lolArrangementFeeUpfront"
                label="(vi) Arrangement Fee Upfront"
                defaultValue={0.005}
                format="pct"
                step={0.05}
                min={0}
                max={5}
              />
              <AssumptionInput
                module="m5"
                assumptionKey="lolArrangementFeeTail"
                label="(vi) Arrangement Fee Tail"
                defaultValue={0.0075}
                format="pct"
                step={0.05}
                min={0}
                max={5}
              />
              <AssumptionInput
                module="m5"
                assumptionKey="lolLegalDD"
                label="(vii) Legal & DD Costs"
                defaultValue={1_500_000}
                format="currency"
                step={0.1}
                min={0}
              />
              {/* Upfront fee treatment toggle */}
              <div className="flex items-start gap-3 mt-3 pt-3 border-t border-slate-100">
                <input
                  id="lolCapitalise"
                  type="checkbox"
                  checked={(state.modules.m5?.assumptions?.['lolUpfrontCapitalised'] ?? 0) !== 0}
                  onChange={e => dispatch({
                    type: 'SET_MODULE_ASSUMPTIONS',
                    module: 'm5',
                    assumptions: { lolUpfrontCapitalised: e.target.checked ? 1 : 0 },
                  })}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
                />
                <label htmlFor="lolCapitalise" className="text-sm text-slate-600 cursor-pointer">
                  <span className="font-medium">Capitalise upfront fee to LoL balance</span>
                  <span className="block text-xs text-slate-400 mt-0.5">
                    Checked: fee added to LoL outstanding (accrues interest, repaid via release pricing).
                    Unchecked (default): fee paid from equity on day 1.
                  </span>
                </label>
              </div>
            </div>
          </div>
          <div className="mt-3 p-2 bg-slate-50 rounded text-xs text-slate-500">
            Term: 5 years (fixed). First IPD: 30 Jun 2026. Item (i) Loan Amount is 65% of APP,
            allocated pro-rata on min(loan amount, collateral value).
          </div>
        </Card>

        {/*  Forecasted Asset Value Changes  */}
        <Card className="sm:col-span-2">
          <SectionHeader
            title="Forecasted Asset Value Changes"
            subtitle="Annual rate applied to each loan's collateral from closing to maturity. Can be positive (appreciating market) or negative (declining market). Recovery = min(balance, forecast collateral value)."
          />

          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Market Adjustment by State</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            {uniqueStates.map(st => (
              <CompactPctInput
                key={st}
                module="m3"
                assumptionKey={`appState_${st}`}
                label={st}
                defaultValue={STATE_RATE_DEFAULTS[st] ?? 0}
              />
            ))}
          </div>

          <div className="p-2 bg-slate-50 rounded text-xs text-slate-500">
            Applied as compound annual growth: forecast collateral = current value × (1 + rate)^years_to_maturity.
          </div>
        </Card>

      </div>

      {/* Reset hint */}
      <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
        <strong>Note:</strong> All parameters are saved automatically to your browser session. To restore assignment
        defaults, refresh the page and re-enter your student ID, or adjust each input back to its default value shown above.
      </div>
    </div>
  );
}

