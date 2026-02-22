import { useState } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { fmt } from '../../lib/format';
import type { CFPeriod } from '../../lib/cashflow';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2,'0')}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;

function exportToCSV(periods: CFPeriod[], purchasePrice: number, exportLabel: string, showLosses: boolean) {
  const n3 = (v: number) => (v / 1e6).toFixed(3);
  const header = showLosses
    ? 'Period,Date,Outstanding BOP ($m),Interest ($m),Principal ($m),Losses ($m),Total Received ($m),Net CF for IRR ($m)'
    : 'Period,Date,Outstanding BOP ($m),Interest ($m),Principal ($m),Total Received ($m),Net CF for IRR ($m)';
  const rows: string[] = [
    '# Instructions: use Date + "Net CF for IRR" columns with Excel XIRR() to calculate portfolio IRR.',
    `# Purchase price: $${n3(purchasePrice)}m  |  Formula: =XIRR(H2:H${periods.length+1},B2:B${periods.length+1})`,
    header,
  ];
  // T=0 acquisition row
  const acqDate = periods[0]?.eop ?? new Date(Date.UTC(2026, 2, 31));
  if (showLosses) {
    rows.push(`0,${fmtDate(acqDate)},${n3(purchasePrice)},0,0,0,0,${n3(-purchasePrice)}`);
  } else {
    rows.push(`0,${fmtDate(acqDate)},${n3(purchasePrice)},0,0,0,${n3(-purchasePrice)}`);
  }
  for (const p of periods) {
    if (p.periodIdx === 0) continue;
    if (showLosses) {
      rows.push([p.periodIdx, fmtDate(p.eop), n3(p.debtOutstandingBOP),
        n3(p.interestPayment), n3(p.principalRepayment), n3(p.loanLosses),
        n3(p.totalCashFromLoans), n3(p.totalCashFromLoans)].join(','));
    } else {
      rows.push([p.periodIdx, fmtDate(p.eop), n3(p.debtOutstandingBOP),
        n3(p.interestPayment), n3(p.principalRepayment),
        n3(p.totalCashFromLoans), n3(p.totalCashFromLoans)].join(','));
    }
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${exportLabel}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

interface CashFlowTableProps {
  periods: CFPeriod[];
  showLosses?: boolean;
  purchasePrice?: number;   // if provided, shows Export CSV button
  exportLabel?: string;     // filename stem for the CSV
  extraRows?: Array<{
    label: string;
    values: number[];
    style?: 'normal' | 'subtotal' | 'total' | 'negative';
  }>;
}

const QUARTER_LABELS: Record<number, string> = { 3: 'Q1', 6: 'Q2', 9: 'Q3', 12: 'Q4' };

function groupByQuarter(periods: CFPeriod[]): { label: string; periods: CFPeriod[] }[] {
  const groups: { label: string; periods: CFPeriod[] }[] = [];
  let current: CFPeriod[] = [];
  for (const p of periods) {
    current.push(p);
    if (p.isIPD || p.periodIdx === 0) {
      const qLabel = p.periodIdx === 0
        ? 'T=0'
        : `${QUARTER_LABELS[p.month] ?? 'Q?'} ${p.eop.getUTCFullYear()}`;
      groups.push({ label: qLabel, periods: [...current] });
      current = [];
    }
  }
  if (current.length > 0) groups.push({ label: 'Tail', periods: current });
  return groups;
}

export function CashFlowTable({ periods, showLosses = false, purchasePrice, exportLabel = 'CashFlows' }: CashFlowTableProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const groups = groupByQuarter(periods);

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // Which periods to show in the table
  const displayPeriods: Array<{ period: CFPeriod; isGroupHeader: boolean; groupLabel: string }> = [];
  for (const group of groups) {
    const isExpanded = expandedGroups.has(group.label);
    const ipdPeriod = group.periods.find(p => p.isIPD || p.periodIdx === 0);

    if (!collapsed) {
      // Expanded: show group header row + all months
      displayPeriods.push({
        period: ipdPeriod ?? group.periods[group.periods.length - 1],
        isGroupHeader: true,
        groupLabel: group.label,
      });
      if (isExpanded) {
        for (const p of group.periods) {
          if (p !== ipdPeriod) {
            displayPeriods.push({ period: p, isGroupHeader: false, groupLabel: group.label });
          }
        }
      }
    } else {
      // Collapsed: show only IPD (quarter-end) rows
      if (ipdPeriod) {
        displayPeriods.push({ period: ipdPeriod, isGroupHeader: false, groupLabel: group.label });
      }
    }
  }

  const cellClass = 'px-3 py-2 text-right text-xs tabular-nums whitespace-nowrap';
  const headerClass = 'px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase';

  const fmtCell = (v: number) => v === 0 ? '' : fmt.currencyM(v, 1);

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 mb-2">
        <h4 className="text-sm font-semibold text-slate-700">Cash Flow Table</h4>
        <button
          onClick={() => setCollapsed(v => !v)}
          className="text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-50 text-slate-500"
        >
          {collapsed ? 'Expand to monthly' : 'Collapse to quarterly'}
        </button>
        {purchasePrice !== undefined && purchasePrice > 0 && (
          <button
            onClick={() => exportToCSV(periods, purchasePrice, exportLabel, showLosses)}
            className="flex items-center gap-1 text-xs px-2 py-1 border border-blue-300 rounded hover:bg-blue-50 text-blue-600"
          >
            <Download size={11} />
            Export CSV
          </button>
        )}
      </div>
      <div className="table-scroll border border-slate-200 rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {!collapsed && <th className="w-4" />}
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase sticky left-0 bg-slate-50">Period</th>
              <th className={headerClass}>Debt O/S (BOP)</th>
              <th className={headerClass}>Interest</th>
              <th className={headerClass}>Principal</th>
              {showLosses && <th className={headerClass}>Losses</th>}
              <th className={headerClass}>Total Cash</th>
              <th className={headerClass}>Net CF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayPeriods.map(({ period: p, isGroupHeader, groupLabel }) => {
              const isExpanded = expandedGroups.has(groupLabel);
              const rowClass = p.periodIdx === 0
                ? 'bg-slate-100 font-semibold'
                : p.isIPD ? 'bg-blue-50/40 font-medium' : 'bg-white text-slate-500';

              return (
                <tr key={`${p.periodIdx}-${isGroupHeader}`} className={rowClass}>
                  {!collapsed && (
                    <td className="pl-2">
                      {isGroupHeader && (
                        <button onClick={() => toggleGroup(groupLabel)} className="p-0.5 text-slate-400 hover:text-slate-600">
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2 text-xs font-medium sticky left-0 bg-inherit whitespace-nowrap">{p.label}</td>
                  <td className={cellClass}>{p.periodIdx === 0 ? '' : fmtCell(p.debtOutstandingBOP)}</td>
                  <td className={cellClass}>{fmtCell(p.interestPayment)}</td>
                  <td className={cellClass}>{fmtCell(p.principalRepayment)}</td>
                  {showLosses && (
                    <td className={`${cellClass} ${p.loanLosses < 0 ? 'text-red-600' : ''}`}>
                      {p.loanLosses !== 0 ? fmtCell(p.loanLosses) : ''}
                    </td>
                  )}
                  <td className={cellClass}>{fmtCell(p.totalCashFromLoans)}</td>
                  {(() => {
                    const netCF = p.periodIdx === 0 && purchasePrice != null
                      ? -purchasePrice
                      : p.netCashflow;
                    return (
                      <td className={`${cellClass} font-semibold ${netCF < 0 ? 'text-red-600' : netCF > 0 ? 'text-green-700' : ''}`}>
                        {netCF !== 0 ? fmtCell(netCF) : ''}
                      </td>
                    );
                  })()}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

