import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { fmt } from '../../lib/format';
import { computeIRRs, cellColor, PRICE_DELTAS, COST_CONFIGS } from './summaryUtils';
import type { SharedAssumptions } from '../../context/AppContext';
import type { Loan } from '../../data/loanTape';

export function SensitivitySection({
  effectiveLoans,
  timeline,
  assumptions,
}: {
  effectiveLoans: Loan[];
  timeline: Date[];
  assumptions: SharedAssumptions;
}) {
  const [open, setOpen] = useState(false);

  const grid = useMemo(() => {
    const base = assumptions.m2PurchasePrice;
    return PRICE_DELTAS.map(delta => {
      const pp = base * (1 + delta);
      return COST_CONFIGS.map(cfg =>
        computeIRRs(effectiveLoans, timeline, assumptions, pp, cfg.nj, cfg.j),
      );
    });
  }, [effectiveLoans, timeline, assumptions]);

  const base = assumptions.m2PurchasePrice;

  return (
    <div className="border border-slate-200 rounded-xl mb-4 mt-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 rounded-xl"
      >
        <div>
          <span className="font-semibold text-slate-800">IRR Sensitivity Analysis</span>
          <span className="ml-2 text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
            Purchase Price — Enforcement Costs
          </span>
        </div>
        {open
          ? <ChevronDown size={16} className="text-slate-400" />
          : <ChevronRight size={16} className="text-slate-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-100">
          <p className="text-xs text-slate-500 mt-3 mb-3">
            Levered IRR across purchase price scenarios (rows) and enforcement cost assumptions (columns).
            Colour: <span className="text-green-700 font-medium">14%</span> 
            <span className="text-green-600"> 12%</span> 
            <span className="text-amber-600"> 9%</span> 
            <span className="text-red-600"> &lt;9%</span>.
            Base price = {fmt.currencyM(base)}.
          </p>
          <div className="overflow-x-auto">
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left px-3 py-2 text-slate-500 font-semibold border-b border-slate-200 whitespace-nowrap">
                    Purchase Price
                  </th>
                  {COST_CONFIGS.map(cfg => (
                    <th
                      key={cfg.label}
                      className="px-3 py-2 text-center text-slate-500 font-semibold border-b border-slate-200 whitespace-pre-line"
                    >
                      {cfg.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PRICE_DELTAS.map((delta, ri) => (
                  <tr key={delta} className={delta === 0 ? 'ring-2 ring-blue-200 ring-inset' : ''}>
                    <td className="px-3 py-2 font-medium text-slate-700 border-b border-slate-100 whitespace-nowrap">
                      {delta === 0 ? ' Base' : delta > 0 ? `+${(delta * 100).toFixed(0)}%` : `${(delta * 100).toFixed(0)}%`}
                      {' '}<span className="text-slate-400">{fmt.currencyM(base * (1 + delta))}</span>
                    </td>
                    {COST_CONFIGS.map((_, ci) => {
                      const r = grid[ri][ci];
                      return (
                        <td
                          key={ci}
                          className={`px-3 py-2 text-center border-b border-slate-100 rounded ${cellColor(r.levered)}`}
                        >
                          <div>{fmt.pct(r.levered)}</div>
                          <div className="text-slate-400 font-normal">{fmt.pct(r.unlevered)} unlev</div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            NJ / Judicial costs shown as pairs (e.g. 5% NJ / 10% judicial).
            All other assumptions held constant at current values.
          </p>
        </div>
      )}
    </div>
  );
}

