import { useState, useMemo } from 'react';
import { Target, TrendingUp, Info, CheckCircle2, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { solvePriceForXIRR } from '../../lib/irr';
import { fmt } from '../../lib/format';
import { PageShell } from '../shared/PageShell';

const SENSITIVITY_IRRS = [0.08, 0.10, 0.12, 0.14, 0.16, 0.18];

export function PriceDiscoveryView() {
  const { m3CF, m4IRR, m4MoIC, timeline, effectiveLoans, assumptions, dispatch } = useApp();

  const [targetIRR, setTargetIRR] = useState(0.125);

  const parValue = useMemo(
    () => effectiveLoans.reduce((s, l) => s + l.amount, 0),
    [effectiveLoans],
  );

  const ldd = 1 + assumptions.m2LegalDDRate;

  // Bid price: goal-seek on Active Resolution (unlevered) cashflows
  const bidPrice = useMemo(
    () => solvePriceForXIRR(targetIRR, m3CF.cashflows.slice(1), timeline) / ldd,
    [targetIRR, m3CF.cashflows, timeline, ldd],
  );

  const discountToPar = (parValue - bidPrice) / parValue;
  const currentPrice = assumptions.m2PurchasePrice;
  const priceApplied = Math.abs(currentPrice - bidPrice) < 1e4;
  const irrPct = (targetIRR * 100).toFixed(1);

  const sensitivityRows = useMemo(() => {
    return SENSITIVITY_IRRS.map(irr => {
      const price = solvePriceForXIRR(irr, m3CF.cashflows.slice(1), timeline) / ldd;
      return { irr, price, discount: (parValue - price) / parValue };
    });
  }, [m3CF.cashflows, timeline, ldd, parValue]);

  const handleApply = () => {
    dispatch({ type: 'SET_MODULE_ASSUMPTIONS', module: 'm2', assumptions: { purchasePrice: bidPrice } });
  };

  return (
    <PageShell narrow>

      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Target size={20} className="text-blue-700" />
          <h1 className="text-2xl font-bold text-slate-900">Price Discovery</h1>
        </div>
        <p className="text-sm text-slate-500">
          Final bid price — goal-seek on the fully underwritten Active Resolution model
        </p>
      </div>

      {/*  Explanation  */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex gap-3">
        <Info size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">How Heron arrives at its Round 1 bid</p>
          <p className="mb-2">
            NPL portfolios never trade at par. Heron works backwards from a target return:
            <em> given everything we know about this portfolio — the four resolution strategies,
            collateral values, enforcement timelines, and servicer costs — what is the maximum
            price we can pay and still meet our hurdle rate?</em>
          </p>
          <p>
            This page synthesises all prior modules into a single bid price. The <strong>unlevered
            hurdle (12%)</strong> drives the acquisition price; the <strong>LoL financing overlay</strong>{' '}
            then amplifies that return to the levered equity IRR target (18%+). Apply the price here
            to propagate it through the full model.
          </p>
        </div>
      </div>

      {/*  Special assumptions  */}
      <div className="border border-slate-200 rounded-xl mb-6 px-4 py-3 bg-slate-50">
        <div className="flex items-center gap-2 mb-2">
          <SlidersHorizontal size={13} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assumptions driving this price</span>
        </div>
        <ul className="text-xs text-slate-600 space-y-1 list-disc ml-4">
          <li><strong>Active Resolution strategies</strong> — A-loan sale yield, B-loan cure & re-performing sale, C-loan DPO discount, D-loan enforcement costs and timelines</li>
          <li><strong>Servicer / AM fee</strong> — applied as a quarterly drag from closing through resolution</li>
          <li><strong>Collateral appreciation</strong> — state-level forecasted asset value changes affecting D-loan recoveries</li>
          <li><strong>Legal DD / closing cost</strong> — {fmt.pct(assumptions.m2LegalDDRate)} of purchase price, deducted to arrive at net bid</li>
        </ul>
        <p className="text-xs text-slate-400 mt-2 italic">
          All inputs are configurable in the <strong>Assumptions</strong> tab. Changes propagate here automatically.
        </p>
      </div>

      {/*  Target IRR slider  */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
        <label className="block text-sm font-semibold text-slate-700 mb-3">
          Unlevered Hurdle Rate: <span className="text-blue-700 text-lg">{irrPct}%</span>
        </label>
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400 w-8">6%</span>
          <input
            type="range"
            min={6}
            max={20}
            step={0.5}
            value={targetIRR * 100}
            onChange={e => setTargetIRR(Number(e.target.value) / 100)}
            className="flex-1 accent-blue-700"
          />
          <span className="text-xs text-slate-400 w-8 text-right">20%</span>
          <input
            type="number"
            min={6}
            max={20}
            step={0.5}
            value={irrPct}
            onChange={e => setTargetIRR(Number(e.target.value) / 100)}
            className="border border-slate-300 rounded-lg px-2 py-1 text-sm w-20 text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <span className="text-sm text-slate-400">%</span>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Par face value: <strong>{fmt.currencyM(parValue)}</strong> · Adjust the hurdle to see how your return target drives the bid price.
        </p>
      </div>

      {/*  Bid price output  */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-5">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700">
            Maximum Bid Price at {irrPct}% Unlevered IRR — Active Resolution Model
          </h2>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs text-amber-700 uppercase font-semibold mb-1">Bid Price</p>
              <p className="text-3xl font-bold text-amber-900">{fmt.currencyM(bidPrice)}</p>
              <p className="text-xs text-amber-700 mt-1">Net of legal DD / closing costs</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Discount to Par</p>
              <p className="text-3xl font-bold text-slate-800">{fmt.pct(discountToPar)}</p>
              <p className="text-xs text-slate-400 mt-1">{fmt.currencyM(bidPrice)} vs. {fmt.currencyM(parValue)} par</p>
            </div>
            <div className={`border rounded-xl p-4 ${priceApplied ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
              <p className={`text-xs uppercase font-semibold mb-1 ${priceApplied ? 'text-green-600' : 'text-blue-600'}`}>
                Levered Equity IRR
              </p>
              {priceApplied ? (
                <>
                  <p className="text-3xl font-bold text-green-900">{fmt.pct(m4IRR)}</p>
                  <p className="text-xs text-green-700 mt-1">MoIC {fmt.x(m4MoIC)} — at applied bid price</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold text-blue-700 mt-1">Apply price </p>
                  <p className="text-xs text-blue-600 mt-1">Currently showing levered return at {fmt.currencyM(currentPrice)}</p>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-3 border-t border-slate-100">
            <div className="flex-1 text-xs text-slate-500">
              {priceApplied
                ? <span className="flex items-center gap-1 text-green-700 font-medium"><CheckCircle2 size={13} /> Bid price applied to model — all modules updated.</span>
                : <>Working assumption: <strong className="text-slate-700">{fmt.currencyM(currentPrice)}</strong> — Apply the goal-seek price to propagate through Active Resolution and Financing modules.</>
              }
            </div>
            <button
              onClick={handleApply}
              disabled={priceApplied}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap
                ${priceApplied
                  ? 'bg-green-100 text-green-700 cursor-default'
                  : 'bg-blue-700 text-white hover:bg-blue-800'}`}
            >
              {priceApplied ? 'Price applied ' : `Apply ${fmt.currencyM(bidPrice)} to model `}
            </button>
          </div>
        </div>

        <div className="px-5 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-800 flex items-start gap-2">
          <TrendingUp size={13} className="mt-0.5 shrink-0" />
          <span>
            At a {irrPct}% unlevered IRR, Heron can bid <strong>{fmt.currencyM(bidPrice)}</strong> — a{' '}
            <strong>{fmt.pct(discountToPar)}</strong> discount to the {fmt.currencyM(parValue)} par face value.
            This discount compensates for D-loan losses, enforcement costs, and resolution complexity — and creates the
            return. Apply the price above, then review Financing to confirm the levered equity return meets Heron's 18%+ target.
          </span>
        </div>
      </div>

      {/*  Sensitivity table  */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700">
            Bid Price Sensitivity — Active Resolution Model across Hurdle Rates
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 uppercase border-b border-slate-100">
                <th className="px-5 py-2 text-left">Hurdle Rate</th>
                <th className="px-5 py-2 text-right">Bid Price</th>
                <th className="px-5 py-2 text-right">Discount to Par</th>
                <th className="px-5 py-2 text-right">vs. Current Target</th>
              </tr>
            </thead>
            <tbody>
              {sensitivityRows.map(row => {
                const isTarget = Math.abs(row.irr - targetIRR) < 0.001;
                return (
                  <tr
                    key={row.irr}
                    className={`border-b border-slate-100 ${isTarget ? 'bg-amber-50 font-semibold' : 'hover:bg-slate-50'}`}
                  >
                    <td className={`px-5 py-2.5 ${isTarget ? 'text-amber-800' : 'text-slate-700'}`}>
                      {fmt.pct(row.irr, 0)}
                      {isTarget && <span className="ml-2 text-xs text-amber-600"> selected</span>}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{fmt.currencyM(row.price)}</td>
                    <td className="px-5 py-2.5 text-right text-slate-600 tabular-nums">{fmt.pct(row.discount)}</td>
                    <td className={`px-5 py-2.5 text-right text-xs tabular-nums ${row.price >= bidPrice ? 'text-green-600' : 'text-red-500'}`}>
                      {row.price >= bidPrice ? '+' : ''}{fmt.currencyM(row.price - bidPrice, 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="px-5 py-2 text-xs text-slate-400 border-t border-slate-100">
            Higher hurdle rate — lower bid price. All rows use current Active Resolution strategy assumptions.
            Change assumptions in the <strong>Assumptions</strong> tab to see how they affect the bid range.
          </p>
        </div>
      </div>

    </PageShell>
  );
}

