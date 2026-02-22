/** Editable assumption field that dispatches updates to the context. */
import { useApp } from '../../context/AppContext';

interface AssumptionInputProps {
  module: 'm1' | 'm2' | 'm3' | 'm4' | 'm5';
  assumptionKey: string;
  label: string;
  defaultValue: number;
  format?: 'pct' | 'currency' | 'number';
  step?: number;
  min?: number;
  max?: number;
}

export function AssumptionInput({
  module, assumptionKey, label, defaultValue, format = 'number', step, min, max,
}: AssumptionInputProps) {
  const { state, dispatch } = useApp();
  const value = state.modules[module]?.assumptions?.[assumptionKey] ?? defaultValue;

  const displayValue = format === 'pct' ? (value * 100).toFixed(2)
    : format === 'currency' ? (value / 1e6).toFixed(1)
    : value.toString();

  const handleChange = (raw: string) => {
    const n = parseFloat(raw);
    if (isNaN(n)) return;
    const actual = format === 'pct' ? n / 100
      : format === 'currency' ? n * 1e6
      : n;
    dispatch({ type: 'SET_MODULE_ASSUMPTIONS', module, assumptions: { [assumptionKey]: actual } });
  };

  return (
    <div className="flex items-center gap-3 mb-2">
      <label className="text-sm text-slate-600 w-52">{label}</label>
      <div className="flex items-center gap-1">
        {format === 'currency' && <span className="text-xs text-slate-400">$</span>}
        <input
          type="number"
          value={displayValue}
          onChange={e => handleChange(e.target.value)}
          step={step ?? (format === 'pct' ? 0.1 : format === 'currency' ? 10 : 1)}
          min={min}
          max={max}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-blue-400 text-right"
        />
        {format === 'pct' && <span className="text-xs text-slate-400">%</span>}
        {format === 'currency' && <span className="text-xs text-slate-400">m</span>}
      </div>
    </div>
  );
}
