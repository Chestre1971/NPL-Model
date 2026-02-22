import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { fmt } from '../../lib/format';
import { computeIRRs } from './summaryUtils';
import type { SharedAssumptions } from '../../context/AppContext';
import type { Loan } from '../../data/loanTape';

const SCENARIO_DEFS = [
  {
    label: 'Bear',
    description: 'Higher entry (+10%), DPO delayed +2Q, elevated enforcement costs',
    priceMultiplier: 1.10,
    dpoDelta: 6,
    njCost: 0.15,
    jCost: 0.25,
    headerColor: 'bg-red-900',
    bodyColor: 'bg-red-50',
  },
  {
    label: 'Base',
    description: 'Current model assumptions',
    priceMultiplier: 1.00,
    dpoDelta: 0,
    njCost: null as null,   // filled at runtime from assumptions
    jCost: null as null,
    headerColor: 'bg-blue-900',
    bodyColor: 'bg-blue-50',
  },
  {
    label: 'Bull',
    description: 'Cheaper entry (-10%), lower enforcement costs',
    priceMultiplier: 0.90,
    dpoDelta: 0,
    njCost: 0.08,
    jCost: 0.12,
    headerColor: 'bg-green-900',
    bodyColor: 'bg-green-50',
  },
] as const;

export function ScenarioSection({
  effectiveLoans,
  timeline,
  assumptions,
}: {
  effectiveLoans: Loan[];
  timeline: Date[];
  assumptions: SharedAssumptions;
}) {
  const [open, setOpen] = useState(false);

  const scenarios = useMemo(() => {
    const base = assumptions.m2PurchasePrice;
    return SCENARIO_DEFS.map(d => {
      const pp = base * d.priceMultiplier;
      const njCost = d.njCost ?? assumptions.m4NJForceCostRate;
      const jCost  = d.jCost  ?? assumptions.m4JForceCostRate;
      const dpoPeriodIdx = Math.min(
        assumptions.m3DPOPeriodIdx + d.dpoDelta,
        timeline.length - 1,
      );
      const r = computeIRRs(effectiveLoans, timeline, assumptions, pp, njCost, jCost, dpoPeriodIdx);
      return { ...d, pp, njCost, jCost, ...r };
    });
  }, [effectiveLoans, timeline, assumptions]);

  return (
    <div className="border border-slate-200 rounded-xl mb-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 rounded-xl"
      >
        <div>
          <span className="font-semibold text-slate-800">Scenario Analysis</span>
          <span className="ml-2 text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
            Bear / Base / Bull
          </span>
        </div>
        {open
          ? <ChevronDown size={16} className="text-slate-400" />
          : <ChevronRight size={16} className="text-slate-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-100">
          <p className="text-xs text-slate-500 mt-3 mb-3">
            Three pre-built scenarios showing how key assumption changes affect levered and unlevered returns.
          </p>
          <div className="grid grid-cols-3 gap-4">
            {scenarios.map(s => (
              <div key={s.label} className="rounded-xl overflow-hidden border border-slate-200">
                <div className={`${s.headerColor} text-white px-4 py-3`}>
                  <p className="font-bold text-base">{s.label}</p>
                  <p className="text-xs opacity-80 mt-0.5">{s.description}</p>
                </div>
                <div className={`${s.bodyColor} p-4 space-y-2`}>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">Purchase Price</span>
                    <span className="font-semibold">{fmt.currencyM(s.pp)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">NJ / J Costs</span>
                    <span className="font-semibold">{fmt.pct(s.njCost)} / {fmt.pct(s.jCost)}</span>
                  </div>
                  {s.dpoDelta > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">DPO delay</span>
                      <span className="font-semibold">+{s.dpoDelta / 3} quarters</span>
                    </div>
                  )}
                  <div className="border-t border-slate-200 pt-2 mt-2 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700 font-medium">Levered IRR</span>
                      <span className={`font-bold ${s.levered >= 0.15 ? 'text-green-700' : s.levered >= 0.12 ? 'text-amber-600' : 'text-red-600'}`}>
                        {fmt.pct(s.levered)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-700 font-medium">Unlevered IRR</span>
                      <span className={`font-bold ${s.unlevered >= 0.125 ? 'text-green-700' : s.unlevered >= 0.10 ? 'text-amber-600' : 'text-red-600'}`}>
                        {fmt.pct(s.unlevered)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Levered MoIC</span>
                      <span className="font-semibold">{fmt.x(s.leveredMoIC)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Unlevered MoIC</span>
                      <span className="font-semibold">{fmt.x(s.unleveredMoIC)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Bear: PP +10%, DPO +2Q, NJ/J costs 15%/25%.
            Bull: PP 10%, NJ/J costs 8%/12%.
            All other assumptions from current Assumptions tab.
          </p>
        </div>
      )}
    </div>
  );
}

