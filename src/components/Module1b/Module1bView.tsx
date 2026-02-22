import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { fmt } from '../../lib/format';
import { StatCard } from '../shared/StatCard';
import { TextAnswerInput } from '../shared/AnswerInput';
import { QuestionBlock } from '../shared/QuestionBlock';
import { calcPortfolioStats, stratifyBy, crossTabRiskJurisdiction } from '../../lib/stats';
import { parseDate } from '../../lib/dateUtils';
import { PageShell } from '../shared/PageShell';
import {
  Info, Layers, MapPin, Calendar, CheckCircle2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList, Legend,
} from 'recharts';

//  Colour maps 
const RF_COLOR: Record<string, string> = {
  A: '#16a34a', B: '#d97706', C: '#ea580c', D: '#dc2626',
};
const RF_LABEL_STYLE: Record<string, string> = {
  A: 'text-green-700 bg-green-100',
  B: 'text-yellow-700 bg-yellow-100',
  C: 'text-orange-700 bg-orange-100',
  D: 'text-red-700 bg-red-100',
};
const RF_RANGE: Record<string, string> = {
  A: '0-70% LTV',
  B: '71-85% LTV',
  C: '86-100% LTV',
  D: '>100% LTV',
};

//  Shared sub-components 
function SectionHeader({ icon, title, sub }: {
  icon: React.ReactNode; title: string; sub?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}


function StratTable({ rows, title, subLabels }: {
  rows: ReturnType<typeof stratifyBy>; title: string; subLabels?: Record<string, string>;
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">{title}</p>
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {['', 'Loans', 'Debt Balance', 'Assets', 'WAM', 'WAC', 'WA LTV'].map(h => (
                <th key={h} className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase text-right first:text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(r => {
              const isTotal = r.label === 'Total';
              return (
                <tr key={r.label} className={isTotal ? 'bg-slate-50 font-bold' : 'hover:bg-slate-50'}>
                  <td className="px-3 py-2 text-sm font-medium whitespace-nowrap">
                    <span>{r.label}</span>
                    {subLabels?.[r.label] && (
                      <span className="ml-2 text-xs font-normal text-slate-400">{subLabels[r.label]}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-sm">{r.totalLoans}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums">{fmt.currencyM(r.totalDebtBalance)}</td>
                  <td className="px-3 py-2 text-right text-sm">{r.totalAssets}</td>
                  <td className="px-3 py-2 text-right text-xs text-slate-500">{r.wam}</td>
                  <td className="px-3 py-2 text-right text-sm tabular-nums">
                    {r.totalLoans > 0 ? fmt.pct(r.wac) : 'n/a'}
                  </td>
                  <td className={`px-3 py-2 text-right text-sm tabular-nums font-medium
                    ${r.waLTV > 1 ? 'text-red-600' : r.waLTV > 0.85 ? 'text-orange-500' : r.waLTV > 0.70 ? 'text-yellow-600' : 'text-green-700'}`}>
                    {r.totalLoans > 0 ? fmt.pct(r.waLTV) : 'n/a'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number; name: string; color?: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  const multi = payload.length > 1;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2 shadow text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={multi ? { color: p.color } : {}}>
          {multi ? `${p.name}: ` : ''}{fmt.currencyM(p.value * 1e6)}
        </p>
      ))}
    </div>
  );
}

//  Main view 
export function Module1bView() {
  const { effectiveLoans, state, dispatch } = useApp();

  const totalFV = useMemo(
    () => effectiveLoans.reduce((s, l) => s + l.amount, 0),
    [effectiveLoans],
  );
  const portfolioStats = useMemo(
    () => calcPortfolioStats(effectiveLoans),
    [effectiveLoans],
  );
  const byRisk = useMemo(() => stratifyBy(effectiveLoans, 'riskFactor'), [effectiveLoans]);
  const byJurisdiction = useMemo(() => stratifyBy(effectiveLoans, 'jurisdiction'), [effectiveLoans]);
  const crossTab = useMemo(() => crossTabRiskJurisdiction(effectiveLoans), [effectiveLoans]);

  const bucketLoans = useMemo(() => ({
    A: effectiveLoans.filter(l => l.riskFactor === 'A'),
    B: effectiveLoans.filter(l => l.riskFactor === 'B'),
    C: effectiveLoans.filter(l => l.riskFactor === 'C'),
    D: effectiveLoans.filter(l => l.riskFactor === 'D'),
  }), [effectiveLoans]);

  const bucketStats = useMemo(() =>
    (['A', 'B', 'C', 'D'] as const).map(rf => {
      const loans = bucketLoans[rf];
      const fv = loans.reduce((s, l) => s + l.amount, 0);
      const col = loans.reduce((s, l) => s + l.collateralValue, 0);
      const wac = fv > 0 ? loans.reduce((s, l) => s + (l.amount / fv) * l.coupon, 0) : 0;
      const waLTV = fv > 0 ? loans.reduce((s, l) => s + (l.amount / fv) * l.ltv, 0) : 0;
      const wamMs = fv > 0
        ? loans.reduce((s, l) => s + (l.amount / fv) * parseDate(l.maturity).getTime(), 0)
        : Date.now();
      const shortfall = Math.max(0, fv - col);
      return {
        rf, count: loans.length, fv, col,
        coverRatio: fv > 0 ? col / fv : 0,
        shortfall, wac, waLTV,
        wam: new Date(wamMs),
        pct: fv / totalFV,
      };
    }),
  [bucketLoans, totalFV]);

  const dStats = bucketStats.find(b => b.rf === 'D')!;
  const dJudicialFV = useMemo(
    () => bucketLoans.D.filter(l => l.judicial === 'J').reduce((s, l) => s + l.amount, 0),
    [bucketLoans.D],
  );
  const dJudicialPct = dStats.fv > 0 ? dJudicialFV / dStats.fv : 0;

  const dByState = useMemo(() => {
    const map = new Map<string, { fv: number; count: number; judicial: boolean }>();
    for (const l of bucketLoans.D) {
      const cur = map.get(l.jurisdiction) ?? { fv: 0, count: 0, judicial: l.judicial === 'J' };
      map.set(l.jurisdiction, { fv: cur.fv + l.amount, count: cur.count + 1, judicial: l.judicial === 'J' });
    }
    return Array.from(map.entries()).sort().map(([st, d]) => ({ state: st, ...d }));
  }, [bucketLoans.D]);

  const maturityByYearBucket = useMemo(() => {
    const map = new Map<string, { A: number; B: number; C: number; D: number }>();
    for (const loan of effectiveLoans) {
      const y = parseDate(loan.maturity).getUTCFullYear().toString();
      const cur = map.get(y) ?? { A: 0, B: 0, C: 0, D: 0 };
      const rf = loan.riskFactor as 'A' | 'B' | 'C' | 'D';
      cur[rf] += loan.amount / 1e6;
      map.set(y, cur);
    }
    return Array.from(map.entries()).sort().map(([year, b]) => ({ year, ...b }));
  }, [effectiveLoans]);

  const riskChartData = bucketStats.map(b => ({
    bucket: b.rf,
    rf: b.rf,
    fvM: b.fv / 1e6,
  }));

  const isComplete = state.modules.m1b?.completed ?? false;

  return (
    <PageShell>

      {/*  Header  */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-slate-900">Portfolio Composition</h2>
        <p className="text-slate-500 text-sm mt-1">
          Stratification analysis — understanding what you're buying before you model it
        </p>
      </div>

      {/*  Explanation  */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex gap-3">
        <Info size={18} className="text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-800 space-y-2">
          <p className="font-semibold">Why stratification is the first step in any NPL underwriting</p>
          <p>
            Every portfolio Heron underwrites will present different characteristics — asset type, geographic
            concentration, vintage, and borrower profile all vary. Those characteristics dictate the resolution
            strategy and shape every modelling assumption that follows.
          </p>
          <p>
            In this case, the portfolio of 302 loans is not a homogeneous pool and Heron has elected to
            classify it into four distinct risk profiles with very different collateral positions, payment
            statuses, and geographic exposures. Segmenting by LTV bucket reveals where value is concentrated
            and where losses are likely. Before you can build any cash flow model, you need to understand{' '}
            <em>what you're buying</em>.
          </p>
        </div>
      </div>

      {/*  Valuation assumption  */}
      <div className="border border-slate-200 rounded-xl mb-6 px-4 py-3 flex gap-2 items-start bg-slate-50">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide shrink-0 mt-0.5">Valuation basis</span>
        <div className="text-xs text-slate-600 space-y-1">
          <p>All collateral values and LTV calculations use the <strong>latest appraised value submitted by the borrower</strong> as recorded in the Metropolitan Bank bid tape.</p>
          <p>Risk bucket classification follows: A 70%  B 7185%  C 86100%  D &gt;100%.</p>
        </div>
      </div>

      {/*  Portfolio Overview KPIs  */}
      <div className="mb-8">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Portfolio Overview</h3>
        <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto">
          <StatCard label="Total Loans" value={portfolioStats.totalLoans.toString()} />
          <StatCard label="Total Face Value" value={fmt.currencyM(totalFV)} color="blue" />
          <StatCard label="Total Collateral" value={fmt.currencyM(bucketStats.reduce((s, b) => s + b.col, 0))} color="green" />
          <StatCard label="WA LTV" value={fmt.pct(portfolioStats.waLTV)}
            color={portfolioStats.waLTV > 1 ? 'red' : portfolioStats.waLTV > 0.85 ? 'amber' : 'green'} />
          <StatCard label="WA Coupon" value={fmt.pct(portfolioStats.wac)} />
          <StatCard
            label="WAM"
            value={portfolioStats.wam.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })}
            sub={`${portfolioStats.wamYears.toFixed(1)} years`}
          />
        </div>
        <p className="text-xs text-slate-400 mt-2 max-w-2xl mx-auto">
          * WAM = Weighted Average Maturity — the balance-weighted average loan maturity date across the portfolio, expressed as a date and years from closing. It indicates when the bulk of principal is expected to be repaid and sets the investment horizon for cash flow modelling.
        </p>
      </div>

      {/*  Stratification by Risk Factor  */}
      <div className="mb-8">
        <SectionHeader
          icon={<Layers size={18} className="text-blue-600" />}
          title="Stratification by Risk Factor"
          sub="Portfolio segmented by LTV bucket — the primary driver of risk, return, and resolution strategy"
        />
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 items-start">
          <div>
            <StratTable rows={byRisk} title="Summary by Risk Bucket" subLabels={RF_RANGE} />
            <p className="text-xs text-slate-400 mt-2">
              * Where LTV exceeds 100%, collateral is worth less than the outstanding balance — full recovery from the security alone is not possible.
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Face Value by Risk Bucket ($m)
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={riskChartData} margin={{ top: 20, right: 20, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v.toFixed(0)}m`} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="fvM" name="Face Value" radius={[4, 4, 0, 0]}>
                  {riskChartData.map(d => (
                    <Cell key={d.rf} fill={RF_COLOR[d.rf]} />
                  ))}
                  <LabelList
                    dataKey="fvM"
                    position="top"
                    formatter={(v: unknown) => `$${(v as number).toFixed(0)}m`}
                    style={{ fontSize: 10, fill: '#475569' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/*  Stratification by Jurisdiction  */}
      <div className="mb-8">
        <SectionHeader
          icon={<MapPin size={18} className="text-purple-600" />}
          title="Stratification by Jurisdiction"
          sub="Geographic concentration — California dominates UPB; New York and Pennsylvania are judicial enforcement states"
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
          <StratTable rows={byJurisdiction} title="Summary by State" />
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-center">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Share of UPB by State</p>
            <div className="flex flex-col gap-4">
              {byJurisdiction.filter(r => r.label !== 'Total').map(r => (
                <div key={r.label} className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 w-32 font-medium">{r.label}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(r.totalDebtBalance / totalFV) * 100}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 w-12 text-right">{fmt.pct(r.totalDebtBalance / totalFV)}</span>
                  <span className="text-xs text-slate-500 w-20 text-right">{fmt.currencyM(r.totalDebtBalance)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/*  Risk  Jurisdiction Cross-Tabulation  */}
      <div className="mb-8">
        <SectionHeader
          icon={<MapPin size={18} className="text-purple-600" />}
          title="Risk — Jurisdiction Cross-Tabulation"
          sub="Each risk bucket broken down by state — shows geographic concentration within each risk profile"
        />
        {(['A', 'B', 'C', 'D'] as const).map(rf => (
          <StratTable key={rf} rows={crossTab[rf]} title={`Risk Factor ${rf} — by State`} />
        ))}
      </div>

      {/*  Maturity Profile  */}
      <div className="mb-8">
        <SectionHeader
          icon={<Calendar size={18} className="text-amber-600" />}
          title="Maturity Profile"
          sub="When does the portfolio repay? Timing drives return and reinvestment risk."
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* WAM table  LEFT */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Weighted Average Maturity by Bucket</p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-slate-100">
              {bucketStats.map(b => (
                <div key={b.rf} className="p-4">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${RF_LABEL_STYLE[b.rf]}`}>{b.rf}</span>
                  <p className="text-sm font-semibold text-slate-800 mt-2">
                    {b.wam.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">WA Coupon: {fmt.pct(b.wac)}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Stacked bar chart  RIGHT */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Face Value by Maturity Year &amp; Risk Bucket ($m)
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={maturityByYearBucket} margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v.toFixed(0)}m`} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="A" stackId="mat" fill={RF_COLOR.A} name="A" />
                <Bar dataKey="B" stackId="mat" fill={RF_COLOR.B} name="B" />
                <Bar dataKey="C" stackId="mat" fill={RF_COLOR.C} name="C" />
                <Bar dataKey="D" stackId="mat" fill={RF_COLOR.D} name="D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/*  D-Loan Judicial Detail  */}
      <div className="mb-8">
        <SectionHeader
          icon={<MapPin size={18} className="text-red-500" />}
          title="D-Loan Geographic & Judicial Classification"
          sub="State-level data for the highest-risk sub-portfolio — judicial classification determines the legal enforcement process"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">D-Loan Portfolio by State</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 border-b border-slate-100">
                  <th className="pb-1 text-left">State</th>
                  <th className="pb-1 text-right">Loans</th>
                  <th className="pb-1 text-right">Face Value</th>
                  <th className="pb-1 text-right">Judicial?</th>
                </tr>
              </thead>
              <tbody>
                {dByState.map(row => (
                  <tr key={row.state} className="border-b border-slate-100 last:border-0">
                    <td className="py-1.5 font-medium">{row.state}</td>
                    <td className="py-1.5 text-right text-slate-600">{row.count}</td>
                    <td className="py-1.5 text-right">{fmt.currencyM(row.fv)}</td>
                    <td className="py-1.5 text-right">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium
                        ${row.judicial ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {row.judicial ? 'Judicial' : 'Non-judicial'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              D-Loan Judicial Split (by Face Value)
            </p>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-red-700 font-medium">Judicial</span>
                  <span className="font-semibold">{fmt.currencyM(dJudicialFV)} ({fmt.pct(dJudicialPct, 1)})</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-red-500 h-2 rounded-full" style={{ width: `${dJudicialPct * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-green-700 font-medium">Non-judicial</span>
                  <span className="font-semibold">
                    {fmt.currencyM(dStats.fv - dJudicialFV)} ({fmt.pct(1 - dJudicialPct, 1)})
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(1 - dJudicialPct) * 100}%` }} />
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
              Total D-loan face value: <strong className="text-slate-800">{fmt.currencyM(dStats.fv)}</strong>
              {' '}({fmt.pct(dStats.pct, 1)} of portfolio)
            </div>
          </div>
        </div>
      </div>

      {/*  Questions  */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Questions</h3>
        <p className="text-sm text-slate-500 mb-6">
          Use the composition tables and risk-state cross-tab above.
        </p>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <QuestionBlock num="Q1" title="Average LTV vs true risk">
            <TextAnswerInput
              questionId="pc_q_avg_not_lowrisk"
              module="m1b"
              label="The portfolio average LTV is below 100%. Explain why that does not mean this portfolio is low-risk."
              rows={5}
            />
          </QuestionBlock>
          <QuestionBlock num="Q2" title="Highest-risk cohort by state and risk">
            <TextAnswerInput
              questionId="pc_q_worst_cohort"
              module="m1b"
              label="From the Risk x State cross-tab, name the cohort (Risk and State) with the largest recovery risk, and explain why."
              rows={5}
            />
          </QuestionBlock>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={() => dispatch({ type: 'MARK_COMPLETE', module: 'm1b' })}
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

