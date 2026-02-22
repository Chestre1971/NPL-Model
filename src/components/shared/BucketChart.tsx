import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

export interface BucketChartDatum {
  name: string;
  interest: number;     // dollars
  principal: number;    // dollars
  losses?: number;      // dollars (negative = loss / cost)
  extraCosts?: number;  // dollars (negative = additional cost bucket)
  outstanding?: number; // millions (already divided by 1e6)
}

interface BucketChartProps {
  data: BucketChartDatum[];
  title?: string;
  showLosses?: boolean;
  showOutstanding?: boolean;
  showInterest?: boolean;
  showExtraCosts?: boolean;
  interestColor?: string;
  principalColor?: string;
  extraCostsColor?: string;
  interestLabel?: string;
  principalLabel?: string;
  lossesLabel?: string;
  extraCostsLabel?: string;
  height?: number;
  /** Shared domain [min, max] for the cash (left) Y-axis  use to sync paired charts */
  yAxisDomain?: [number | 'auto', number | 'auto'];
  /** Shared max for the outstanding (right) Y-axis  use to sync paired charts */
  outAxisMax?: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const fmtDollars = (v: number) => `$${(v / 1e6).toFixed(2)}m`;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-lg text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((e: any) =>
        e.value !== 0 && (
          <p key={e.name} style={{ color: e.color }}>
            {e.name}: {e.dataKey === 'outstanding' ? `$${Number(e.value).toFixed(1)}m` : fmtDollars(e.value)}
          </p>
        )
      )}
    </div>
  );
};

export function BucketChart({
  data,
  title,
  showLosses = false,
  showOutstanding = false,
  showInterest = true,
  showExtraCosts = false,
  interestColor = '#3b82f6',
  principalColor = '#1e3a5f',
  extraCostsColor = '#ef4444',
  interestLabel = 'Interest',
  principalLabel = 'Principal',
  lossesLabel = 'Losses / Costs',
  extraCostsLabel = 'Additional Costs',
  height = 180,
  yAxisDomain,
  outAxisMax,
}: BucketChartProps) {
  const hasOutstanding = showOutstanding && data.some(d => d.outstanding != null);
  const rightMargin = hasOutstanding ? 48 : 8;

  return (
    <div>
      {title && <p className="text-xs font-semibold text-slate-600 mb-1">{title}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 2, right: rightMargin, left: 4, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 8 }} interval="preserveStartEnd" />
          <YAxis
            yAxisId="cash"
            tickFormatter={v => `$${(v / 1e6).toFixed(0)}m`}
            tick={{ fontSize: 8 }}
            width={46}
            domain={yAxisDomain ?? ['auto', 'auto']}
            label={{ value: 'Cash Flow ($m)', angle: -90, position: 'insideLeft', style: { fontSize: 8, fill: '#64748b' } }}
          />
          {hasOutstanding && (
            <YAxis
              yAxisId="out"
              orientation="right"
              tickFormatter={v => `$${Number(v).toFixed(0)}m`}
              tick={{ fontSize: 8 }}
              width={44}
              domain={[0, outAxisMax != null ? outAxisMax : 'auto']}
              label={{ value: 'Outstanding ($m)', angle: 90, position: 'insideRight', style: { fontSize: 8, fill: '#64748b' } }}
            />
          )}
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 9 }} />
          <ReferenceLine yAxisId="cash" y={0} stroke="#94a3b8" />
          {showInterest && (
            <Bar yAxisId="cash" dataKey="interest" name={interestLabel} fill={interestColor} stackId="a" />
          )}
          <Bar yAxisId="cash" dataKey="principal" name={principalLabel} fill={principalColor} stackId="a" />
          {showLosses && (
            <Bar yAxisId="cash" dataKey="losses" name={lossesLabel} fill="#ef4444" stackId="a" />
          )}
          {showExtraCosts && (
            <Bar yAxisId="cash" dataKey="extraCosts" name={extraCostsLabel} fill={extraCostsColor} stackId="a" />
          )}
          {hasOutstanding && (
            <Line
              yAxisId="out"
              type="monotone"
              dataKey="outstanding"
              name="Outstanding ($m)"
              stroke="#c8a84b"
              strokeWidth={1.5}
              dot={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

