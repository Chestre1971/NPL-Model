import { Component, lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { AppShell } from './components/layout/AppShell';

const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
const LoanTapeView = lazy(() => import('./components/LoanTape/LoanTapeView').then(m => ({ default: m.LoanTapeView })));
const Module0View = lazy(() => import('./components/Module0/Module0View').then(m => ({ default: m.Module0View })));
const Module1bView = lazy(() => import('./components/Module1b/Module1bView').then(m => ({ default: m.Module1bView })));
const Module2View = lazy(() => import('./components/Module2/Module2View').then(m => ({ default: m.Module2View })));
const Module3View = lazy(() => import('./components/Module3/Module3View').then(m => ({ default: m.Module3View })));
const Module4View = lazy(() => import('./components/Module4/Module4View').then(m => ({ default: m.Module4View })));
const EnforcementView = lazy(() => import('./components/Enforcement/EnforcementView').then(m => ({ default: m.EnforcementView })));
const Module5View = lazy(() => import('./components/Module5/Module5View').then(m => ({ default: m.Module5View })));
const SummaryView = lazy(() => import('./components/Summary/SummaryView').then(m => ({ default: m.SummaryView })));
const AssumptionsView = lazy(() => import('./components/Assumptions/AssumptionsView').then(m => ({ default: m.AssumptionsView })));
const ICMemoView = lazy(() => import('./components/ICMemo/ICMemoView').then(m => ({ default: m.ICMemoView })));
const RescueCapitalView = lazy(() => import('./components/RescueCapital/RescueCapitalView').then(m => ({ default: m.RescueCapitalView })));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-900" />
    </div>
  );
}

function withSuspense(node: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{node}</Suspense>;
}

// ── Error boundary ──────────────────────────────────────────────────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
          <div className="bg-white border border-red-200 rounded-2xl shadow-lg p-8 max-w-xl w-full">
            <h1 className="text-lg font-bold text-red-700 mb-2">Something went wrong</h1>
            <pre className="text-xs text-slate-600 bg-slate-100 rounded p-4 overflow-auto whitespace-pre-wrap">
              {(this.state.error as Error).message}
              {'\n\n'}
              {(this.state.error as Error).stack}
            </pre>
            <button
              onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}
              className="mt-4 px-4 py-2 bg-blue-900 text-white text-sm rounded-lg hover:bg-blue-800"
            >
              Back to login
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Auth guard ──────────────────────────────────────────────────────────────
function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useApp();
  if (!state.session) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// ── Routes ──────────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={withSuspense(<LoginPage />)} />
      <Route path="/admin" element={withSuspense(<AdminPage />)} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="deal-brief" replace />} />
        <Route path="deal-brief" element={withSuspense(<Module0View />)} />
        <Route path="loan-tape" element={withSuspense(<LoanTapeView />)} />
        <Route path="portfolio-composition" element={withSuspense(<Module1bView />)} />
        <Route path="performing-baseline" element={withSuspense(<Module2View />)} />
        <Route path="recovery-analysis" element={withSuspense(<Module3View />)} />
        <Route path="enforcement" element={withSuspense(<EnforcementView />)} />
        <Route path="active-resolution" element={withSuspense(<Module4View />)} />
        <Route path="financing" element={withSuspense(<Module5View />)} />
        <Route path="rescue-capital" element={withSuspense(<RescueCapitalView />)} />
        <Route path="assumptions" element={withSuspense(<AssumptionsView />)} />
        <Route path="summary" element={withSuspense(<SummaryView />)} />
        <Route path="ic-memo" element={withSuspense(<ICMemoView />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// ── Root ────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </AppProvider>
    </BrowserRouter>
  );
}
