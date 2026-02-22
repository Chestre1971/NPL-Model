import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { type Loan } from '../../data/loanTape';
import { fmt } from '../../lib/format';
import { useApp } from '../../context/AppContext';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, Pencil, RotateCcw, Check, X } from 'lucide-react';
import { PageShell } from '../shared/PageShell';

const helper = createColumnHelper<Loan>();

const COLUMN_TOOLTIPS: Record<string, string> = {
  id:             '#    Row number (display only)',
  loanId:         'Loan ID    Unique identifier for each loan in the bid tape',
  borrower:       'Borrower    Legal entity or individual obligor on the loan',
  jurisdiction:   'Jurisdiction    State in which the collateral is located, determining foreclosure law and enforcement timeline',
  riskFactor:     'Risk    LTV-based classification: A  70%  B 7185%  C 86100%  D > 100%',
  amount:         'Loan Amount    Outstanding principal balance as at the bid date (USD)',
  coupon:         'Coupon    Contractual annual interest rate on the loan',
  ltv:            'LTV    Loan-to-Value: outstanding balance ÷ independent appraised collateral value',
  maturity:       'Maturity    Contractual loan maturity date (full principal repayment due)',
  assets:         'Assets    Number of real estate assets cross-collateralising this loan',
  collateralValue:'Coll. Value    Last appraised value submitted by the borrower (USD)',
  judicial:       'Enforcement    Judicial: court-supervised foreclosure (slower, 1836 months). Non-judicial: power-of-sale, no court required (faster, 612 months)',
};

const riskColors: Record<string, string> = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-yellow-100 text-yellow-800',
  C: 'bg-orange-100 text-orange-800',
  D: 'bg-red-100 text-red-800',
};

const RISK_OPTIONS = ['All', 'A', 'B', 'C', 'D'];
const JURISDICTIONS = ['All', 'California', 'New York', 'New Hampshire', 'Pennsylvania'];
const JURISDICTION_OPTIONS = ['California', 'New York', 'New Hampshire', 'Pennsylvania'];

//  Edit panel 
function EditPanel({
  loan,
  isOverridden,
  onSave,
  onReset,
  onClose,
}: {
  loan: Loan;
  isOverridden: boolean;
  onSave: (changes: { amount: number; coupon: number; collateralValue: number; maturity: string; jurisdiction: string }) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState((loan.amount / 1e6).toFixed(4));
  const [coupon, setCoupon] = useState((loan.coupon * 100).toFixed(4));
  const [collateralValue, setCollateralValue] = useState((loan.collateralValue / 1e6).toFixed(4));
  const [maturity, setMaturity] = useState(loan.maturity);
  const [jurisdiction, setJurisdiction] = useState(loan.jurisdiction);

  const previewLTV = parseFloat(collateralValue) > 0
    ? parseFloat(amount) / parseFloat(collateralValue)
    : null;
  const previewRisk = previewLTV == null ? '?' :
    previewLTV <= 0.70 ? 'A' : previewLTV <= 0.85 ? 'B' : previewLTV <= 1.0 ? 'C' : 'D';
  const riskChanged = previewRisk !== loan.riskFactor;

  const handleSave = () => {
    onSave({
      amount: parseFloat(amount) * 1e6,
      coupon: parseFloat(coupon) / 100,
      collateralValue: parseFloat(collateralValue) * 1e6,
      maturity,
      jurisdiction,
    });
    onClose();
  };

  const field = 'border border-slate-200 rounded-lg px-2 py-1.5 text-xs w-full focus:outline-none focus:ring-2 focus:ring-blue-400';

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 my-1">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-amber-800">Editing: {loan.loanId}</span>
          <span className="text-xs text-amber-600">({loan.borrower})</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Amount ($m)</label>
          <input type="number" step="0.1" value={amount} onChange={e => setAmount(e.target.value)} className={field} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Coupon (%)</label>
          <input type="number" step="0.01" value={coupon} onChange={e => setCoupon(e.target.value)} className={field} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Coll. Value ($m)</label>
          <input type="number" step="0.1" value={collateralValue} onChange={e => setCollateralValue(e.target.value)} className={field} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Maturity</label>
          <input type="date" value={maturity} onChange={e => setMaturity(e.target.value)} className={field} />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Jurisdiction</label>
          <select value={jurisdiction} onChange={e => setJurisdiction(e.target.value)} className={field}>
            {JURISDICTION_OPTIONS.map(j => <option key={j}>{j}</option>)}
          </select>
        </div>
      </div>

      {/* Live LTV preview */}
      {previewLTV != null && (
        <div className="flex items-center gap-3 mb-3 text-xs">
          <span className="text-slate-500">Preview LTV:</span>
          <span className={`font-bold ${previewLTV > 1 ? 'text-red-600' : previewLTV > 0.85 ? 'text-orange-500' : previewLTV > 0.70 ? 'text-yellow-600' : 'text-green-700'}`}>
            {fmt.pct(previewLTV)}
          </span>
          <span className="text-slate-500"> Risk Factor:</span>
          <span className={`px-2 py-0.5 rounded-full font-bold ${riskColors[previewRisk] ?? ''}`}>{previewRisk}</span>
          {riskChanged && <span className="text-amber-600 font-medium"> Risk Factor changes from {loan.riskFactor}</span>}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-900 text-white text-xs rounded-lg hover:bg-blue-800"
        >
          <Check size={12} /> Save Changes
        </button>
        {isOverridden && (
          <button
            onClick={() => { onReset(); onClose(); }}
            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 text-slate-600 text-xs rounded-lg hover:bg-slate-50"
          >
            <RotateCcw size={12} /> Reset to Original
          </button>
        )}
        <button onClick={onClose} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700">
          Cancel
        </button>
      </div>
    </div>
  );
}

//  Main view 
export function LoanTapeView() {
  const { effectiveLoans, state, dispatch } = useApp();
  const isComplete = state.modules.m1?.completed ?? false;
  const loanOverrides = state.loanOverrides;

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');
  const [jurisdictionFilter, setJurisdictionFilter] = useState('All');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const overrideCount = Object.keys(loanOverrides).length;

  const filteredData = useMemo(() => {
    return effectiveLoans.filter(l => {
      if (riskFilter !== 'All' && l.riskFactor !== riskFilter) return false;
      if (jurisdictionFilter !== 'All' && l.jurisdiction !== jurisdictionFilter) return false;
      if (globalFilter) {
        const q = globalFilter.toLowerCase();
        return l.loanId.toLowerCase().includes(q)
          || l.borrower.toLowerCase().includes(q)
          || l.jurisdiction.toLowerCase().includes(q);
      }
      return true;
    });
  }, [effectiveLoans, riskFilter, jurisdictionFilter, globalFilter]);

  const columns = useMemo(() => [
    helper.accessor('id', { header: '#', size: 40, cell: i => <span className="text-slate-400">{i.getValue()}</span> }),
    helper.accessor('loanId', {
      header: 'Loan ID',
      cell: i => (
        <span className="flex items-center gap-1">
          <code className="text-xs">{i.getValue()}</code>
          {loanOverrides[i.getValue()] && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" title="Modified" />
          )}
        </span>
      ),
    }),
    helper.accessor('borrower', { header: 'Borrower', size: 180 }),
    helper.accessor('jurisdiction', { header: 'Jurisdiction' }),
    helper.accessor('amount', { header: 'Loan Amount', cell: i => <span className="num">{fmt.currency(i.getValue())}</span> }),
    helper.accessor('coupon', { header: 'Coupon', cell: i => <span className="num">{fmt.pct(i.getValue())}</span> }),
    helper.accessor('maturity', { header: 'Maturity', cell: i => <span className="text-xs">{fmt.date(i.getValue())}</span> }),
    helper.accessor('assets', { header: 'Assets', cell: i => <span className="num">{i.getValue()}</span> }),
    helper.accessor('collateralValue', { header: 'Coll. Value', cell: i => <span className="num">{fmt.currency(i.getValue())}</span> }),
    helper.accessor('riskFactor', {
      header: 'Risk',
      cell: i => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${riskColors[i.getValue()] ?? ''}`}>
          {i.getValue()}
        </span>
      ),
    }),
    helper.accessor('ltv', {
      header: 'LTV',
      cell: i => {
        const v = i.getValue();
        const color = v > 1 ? 'text-red-600 font-bold' : v > 0.85 ? 'text-orange-500' : v > 0.70 ? 'text-yellow-600' : 'text-green-700';
        return <span className={`num ${color}`}>{fmt.pct(v)}</span>;
      },
    }),
    helper.accessor('judicial', {
      header: 'Enforcement',
      cell: i => <span className="text-xs">{i.getValue() === 'J' ? ' Judicial' : 'Non-Judicial'}</span>,
    }),
    // Edit button column
    helper.display({
      id: 'edit',
      header: '',
      cell: i => {
        const loanId = i.row.original.loanId;
        const isEditing = expandedRow === loanId;
        const isModified = !!loanOverrides[loanId];
        return (
          <button
            onClick={() => setExpandedRow(isEditing ? null : loanId)}
            className={`p-1.5 rounded-lg transition-colors ${isEditing ? 'bg-blue-100 text-blue-700' : isModified ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-300 hover:text-slate-600 hover:bg-slate-100'}`}
            title="Edit loan"
          >
            <Pencil size={12} />
          </button>
        );
      },
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [loanOverrides, expandedRow]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const total = filteredData.reduce((s, l) => s + l.amount, 0);

  return (
    <PageShell full>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Loan Tape</h2>
          <p className="text-sm text-slate-500 mt-1">
            Bid tape issued by Metropolitan Bank to all qualified bidders — {effectiveLoans.length} performing and non-performing commercial real estate loans across four U.S. states, with an aggregate outstanding balance of {fmt.currencyM(effectiveLoans.reduce((s, l) => s + l.amount, 0))}.
          </p>
        </div>
        {overrideCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
              {overrideCount} loan{overrideCount > 1 ? 's' : ''} modified
            </span>
            <button
              onClick={() => { dispatch({ type: 'RESET_ALL_LOANS' }); setExpandedRow(null); }}
              className="flex items-center gap-1 text-xs text-slate-500 border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50"
            >
              <RotateCcw size={12} /> Reset All
            </button>
          </div>
        )}
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="bg-blue-950 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
          {filteredData.length} loans shown
        </div>
        <div className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium">
          Total balance: {fmt.currencyM(total)}
        </div>
        <div className="text-xs text-slate-400 px-2 py-1.5 flex items-center gap-1">
          <Pencil size={11} /> Click a row's pencil icon to edit
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder="Search borrower, loan ID..."
            className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="flex items-center gap-1">
          {RISK_OPTIONS.map(r => (
            <button
              key={r}
              onClick={() => setRiskFilter(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors
                ${riskFilter === r
                  ? 'bg-blue-900 text-white border-blue-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
            >
              {r === 'All' ? 'All Risks' : `Risk ${r}`}
            </button>
          ))}
        </div>
        <select
          value={jurisdictionFilter}
          onChange={e => setJurisdictionFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          {JURISDICTIONS.map(j => <option key={j}>{j}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="table-scroll border border-slate-200 rounded-xl shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => (
                  <th
                    key={header.id}
                    className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none whitespace-nowrap"
                    onClick={header.column.getToggleSortingHandler()}
                    title={COLUMN_TOOLTIPS[header.column.id]}
                  >
                    <span className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        header.column.getIsSorted() === 'asc' ? <ChevronUp size={12} /> :
                        header.column.getIsSorted() === 'desc' ? <ChevronDown size={12} /> :
                        <ChevronsUpDown size={12} className="opacity-30" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.map(row => {
              const loan = row.original;
              const isModified = !!loanOverrides[loan.loanId];
              const isExpanded = expandedRow === loan.loanId;
              return (
                <>
                  <tr
                    key={row.id}
                    className={`transition-colors ${isExpanded ? 'bg-amber-50' : isModified ? 'bg-amber-50/40' : 'hover:bg-slate-50'}`}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        className={`px-3 py-2 whitespace-nowrap ${isModified && !isExpanded ? 'border-l-2 border-l-amber-400 first:border-l-2' : ''}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {isExpanded && (
                    <tr key={`${row.id}-edit`}>
                      <td colSpan={columns.length} className="px-3 pb-2">
                        <EditPanel
                          loan={loan}
                          isOverridden={isModified}
                          onSave={changes => dispatch({ type: 'OVERRIDE_LOAN', loanId: loan.loanId, changes })}
                          onReset={() => dispatch({ type: 'RESET_LOAN', loanId: loan.loanId })}
                          onClose={() => setExpandedRow(null)}
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-slate-500">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} · {filteredData.length} results
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
          >
             Previous
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
          >
            Next 
          </button>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={() => dispatch({ type: 'MARK_COMPLETE', module: 'm1' })}
          disabled={isComplete}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors
            ${isComplete
              ? 'bg-green-100 text-green-700 cursor-default'
              : 'bg-blue-700 text-white hover:bg-blue-800'}`}
        >
          <Check size={15} />
          {isComplete ? 'Completed' : 'Mark Complete'}
        </button>
      </div>
    </PageShell>
  );
}

