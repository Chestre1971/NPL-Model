interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  color?: 'default' | 'blue' | 'green' | 'red' | 'amber';
}

const colorMap = {
  default: 'bg-white border-slate-200 text-slate-700',
  blue: 'bg-blue-50 border-blue-200 text-blue-800',
  green: 'bg-green-50 border-green-200 text-green-800',
  red: 'bg-red-50 border-red-200 text-red-800',
  amber: 'bg-amber-50 border-amber-200 text-amber-800',
};

export function StatCard({ label, value, sub, color = 'default' }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wider opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  );
}
