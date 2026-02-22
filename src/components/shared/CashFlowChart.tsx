import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { CFPeriod } from '../../lib/cashflow';

interface CashFlowChartProps {
  periods: CFPeriod[];
  showLosses?: boolean;
  title?: string;
}

const formatM = (v: number) => `$${(v / 1e6).toFixed(0)}m`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold mb-2">{label}</p>
      {payload.map((entry: any) => (
        entry.value !== 0 && (
          <p key={entry.name} style={{ color: entry.color }}>
            {entry.name}: {formatM(entry.value)}
          </p>
        )
      ))}
    </div>
  );
};

export function CashFlowChart({ periods, showLosses = false, title }: CashFlowChartProps) {
  // Filter to IPD periods only (quarterly) + T=0
  const data = periods
    .filter(p => p.periodIdx === 0 || p.isIPD)
    .map(p => ({
      name: p.label,
      interest: p.interestPayment,
      principal: p.principalRepayment,
      losses: p.loanLosses,
      outstanding: p.outstandingPrincipal / 1e6,
    }));

  return (
    <div className="mb-4">
      {title && <h4 className="text-sm font-semibold text-slate-700 mb-2">{title}</h4>}
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, left: 16, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis
            yAxisId="cash"
            tickFormatter={formatM}
            tick={{ fontSize: 10 }}
            width={60}
            label={{ value: 'Cash Flow ($m)', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#64748b' } }}
          />
          <YAxis
            yAxisId="outstanding"
            orientation="right"
            tickFormatter={v => `$${v.toFixed(0)}m`}
            tick={{ fontSize: 10 }}
            width={60}
            label={{ value: 'Outstanding ($m)', angle: 90, position: 'insideRight', style: { fontSize: 10, fill: '#64748b' } }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine yAxisId="cash" y={0} stroke="#94a3b8" />
          <Bar yAxisId="cash" dataKey="interest" name="Interest" fill="#3b82f6" stackId="a" />
          <Bar yAxisId="cash" dataKey="principal" name="Principal" fill="#1e3a5f" stackId="a" />
          {showLosses && (
            <Bar yAxisId="cash" dataKey="losses" name="Loan Losses" fill="#ef4444" stackId="a" />
          )}
          <Line
            yAxisId="outstanding"
            type="monotone"
            dataKey="outstanding"
            name="Outstanding ($m)"
            stroke="#c8a84b"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
