import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { BookOpen, LogOut, CheckCircle2, SlidersHorizontal } from 'lucide-react';

const tabs = [
  { to: '/app/deal-brief',            label: 'Deal Brief',             module: 'm0'    as const },
  { to: '/app/loan-tape',             label: 'Loan Tape',              module: null },
  { to: '/app/portfolio-composition', label: 'Portfolio Composition',  module: 'm1b'  as const },
  { to: '/app/performing-baseline',   label: 'Performing Baseline',    module: 'm2'   as const },
  { to: '/app/recovery-analysis',     label: 'Recovery Analysis',      module: 'm3'   as const },
  { to: '/app/enforcement',           label: 'Enforcement',            module: 'm_enf' as const },
  { to: '/app/active-resolution',     label: 'Active Resolution',      module: 'm4'   as const },
  { to: '/app/financing',             label: 'Loan-on-Loan Financing',  module: 'm5'   as const },
  { to: '/app/summary',               label: 'Summary',                module: null },
  { to: '/app/ic-memo',               label: 'IC Memo',                module: 'm_ic'  as const },
  { to: '/app/rescue-capital',        label: 'Rescue Capital ',      module: null },
  { to: '/app/assumptions',           label: 'Assumptions',            module: null, icon: true },
];

export function AppShell() {
  const { state, signOut } = useApp();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-blue-950 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <BookOpen size={20} className="text-amber-400" />
          <div>
            <span className="font-bold text-sm">NPL Underwriting Model</span>
            <span className="text-blue-300 text-xs ml-2">Cornell REAL 6595</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {state.session && (
            <span className="text-xs text-blue-200">
              {state.session.name} · <span className="text-blue-400">{state.session.studentId}</span>
            </span>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-xs text-blue-300 hover:text-white transition-colors"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      {/* Tab navigation */}
      <nav className="bg-white border-b border-slate-200 px-4 flex gap-1 overflow-x-auto">
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 text-center max-w-[120px] transition-colors
               ${isActive
                ? 'border-blue-700 text-blue-800'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`
            }
          >
            {tab.icon && <SlidersHorizontal size={13} />}
            {tab.label}
            {tab.module && state.modules[tab.module]?.completed && (
              <CheckCircle2 size={13} className="text-green-500" />
            )}
          </NavLink>
        ))}
        {/* Admin  subtle, external link */}
        <a
          href="/admin"
          className="flex items-center px-3 py-3 text-sm font-medium border-b-2 border-transparent text-center max-w-[120px] transition-colors opacity-25 hover:opacity-60 text-slate-400 hover:text-slate-600"
        >
          Admin
        </a>
      </nav>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
