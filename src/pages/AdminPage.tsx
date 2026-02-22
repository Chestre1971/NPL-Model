import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, BrainCircuit, Check, CheckCircle2, Copy, RefreshCw, Users, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { loadAllStudentRecords, type StudentRecord } from '../lib/storage';
import { MODULE_QUESTION_ORDER, QUESTION_REGISTRY } from '../lib/questions';
import { buildGradingPrompt } from '../lib/gradingPrompt';

const COMPLETION_MODULES = ['m1b', 'm2', 'm3', 'm4', 'm5'] as const;
const MODULE_SHORT_LABEL: Record<string, string> = {
  m1b: 'Portfolio',
  m2: 'Baseline',
  m3: 'Recovery',
  m4: 'Resolution',
  m5: 'Financing',
};

function GradingPromptModal({ promptText, onClose }: { promptText: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(async () => {
    await navigator.clipboard.writeText(promptText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [promptText]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <BrainCircuit size={18} className="text-blue-600" />
            <h2 className="font-bold text-slate-900">AI Grading Prompt</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-5 flex-1 overflow-hidden">
          <textarea readOnly value={promptText} className="w-full h-full border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-700 resize-none bg-slate-50" />
        </div>
        <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg">Close</button>
          <button onClick={onCopy} className={`px-4 py-1.5 text-sm font-semibold rounded-lg text-white ${copied ? 'bg-green-600' : 'bg-blue-700 hover:bg-blue-800'}`}>
            {copied ? (<span className="inline-flex items-center gap-1"><Check size={14} /> Copied</span>) : (<span className="inline-flex items-center gap-1"><Copy size={14} /> Copy</span>)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminPage() {
  const { state, authLoading, userRole } = useApp();
  const [resolvedRole, setResolvedRole] = useState<'student' | 'instructor' | null>(userRole);
  const [resolvedEmail, setResolvedEmail] = useState<string>('');
  const [records, setRecords] = useState<StudentRecord[]>([]);
  const [selected, setSelected] = useState<StudentRecord | null>(null);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [promptText, setPromptText] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setRecords(loadAllStudentRecords());
      return;
    }
    setLoadingRecords(true);
    setLoadError('');

    const { data: states, error: stateErr } = await supabase
      .from('student_states')
      .select('user_id, state_json, updated_at')
      .order('updated_at', { ascending: false });
    if (stateErr) {
      setLoadError(stateErr.message);
      setLoadingRecords(false);
      return;
    }

    const { data: profiles } = await supabase.from('profiles').select('id, email, full_name');
    const profilesById = new Map((profiles ?? []).map(p => [p.id, p]));

    const parsed: StudentRecord[] = (states ?? []).map(row => {
      const payload = (row.state_json ?? {}) as Partial<StudentRecord>;
      const profile = profilesById.get(row.user_id);
      return {
        session: payload.session ?? {
          studentId: profile?.email ?? row.user_id,
          name: profile?.full_name?.trim() || profile?.email?.split('@')[0] || 'Student',
          startedAt: row.updated_at ?? new Date().toISOString(),
          lastActive: row.updated_at ?? new Date().toISOString(),
        },
        modules: payload.modules ?? ({} as StudentRecord['modules']),
      };
    });

    setRecords(parsed);
    setLoadingRecords(false);
  }, []);

  useEffect(() => {
    setResolvedRole(userRole);
  }, [userRole]);

  useEffect(() => {
    const run = async () => {
      if (!supabase || !state.session) return;
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;
      setResolvedEmail(user.email ?? '');
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, email')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.role === 'instructor' || profile?.role === 'student') {
        setResolvedRole(profile.role);
      }
      if (profile?.email) setResolvedEmail(profile.email);
    };
    void run();
  }, [state.session]);

  useEffect(() => {
    if (authLoading) return;
    if (!supabase) {
      setRecords(loadAllStudentRecords());
      return;
    }
    if (state.session && resolvedRole === 'instructor') {
      void refresh();
    }
  }, [authLoading, state.session, resolvedRole, refresh]);

  const completionStats = useMemo(() => {
    return COMPLETION_MODULES.map(m => ({
      module: m,
      label: MODULE_SHORT_LABEL[m] ?? m,
      count: records.filter(r => r.modules[m]?.completed).length,
    }));
  }, [records]);

  const openPrompt = useCallback((record: StudentRecord) => {
    setPromptText(buildGradingPrompt(record));
    setShowPrompt(true);
  }, []);

  if (authLoading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">Loading...</div>;
  }
  if (!state.session) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-700">Sign in first at <a className="ml-1 underline" href="/">/</a>.</div>;
  }
  if (resolvedRole !== 'instructor') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-700">
        Instructor access only. Logged in as: {resolvedEmail || state.session.studentId} (role: {resolvedRole ?? 'unknown'})
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-blue-950 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen size={20} className="text-amber-400" />
          <div>
            <h1 className="font-bold">Professor Dashboard</h1>
            <p className="text-xs text-blue-300">NPL Underwriting Model - Cornell REAL 6595</p>
          </div>
        </div>
        <button onClick={() => void refresh()} className="flex items-center gap-1 text-xs text-blue-300 hover:text-white">
          <RefreshCw size={14} /> Refresh
        </button>
      </header>

      <div className="p-6 max-w-7xl mx-auto">
        {loadError && <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{loadError}</div>}

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users size={16} className="text-blue-600" />
              <span className="text-xs text-slate-500 uppercase font-semibold">Students</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">{records.length}</p>
          </div>
          {completionStats.map(s => (
            <div key={s.module} className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 uppercase font-semibold mb-1 truncate">{s.label}</p>
              <p className="text-3xl font-bold text-slate-900">{s.count}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">Students ({records.length})</h2>
            <div className="space-y-2">
              {loadingRecords && <div className="text-xs text-slate-400 p-2">Loading records...</div>}
              {records.length === 0 && !loadingRecords && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-400">
                  No student records found.
                </div>
              )}
              {records.map(r => (
                <button
                  key={r.session.studentId}
                  onClick={() => setSelected(r)}
                  className={`w-full text-left p-3 rounded-xl border ${selected?.session.studentId === r.session.studentId ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-slate-900">{r.session.name}</span>
                    <span className="text-xs text-slate-400">{r.session.studentId}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {COMPLETION_MODULES.map(m => (
                      <span key={m} className="inline-flex items-center gap-1">
                        {MODULE_SHORT_LABEL[m]}
                        {r.modules[m]?.completed ? <CheckCircle2 size={12} className="text-green-500" /> : <span className="text-slate-300">-</span>}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            {!selected ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400">Select a student</div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{selected.session.name}</h2>
                    <p className="text-sm text-slate-500">{selected.session.studentId}</p>
                  </div>
                  <button onClick={() => openPrompt(selected)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg">
                    <BrainCircuit size={13} /> Grade with AI
                  </button>
                </div>

                {Object.entries(MODULE_QUESTION_ORDER).map(([moduleId, qIds]) => {
                  const moduleData = selected.modules[moduleId as keyof StudentRecord['modules']];
                  const txt = moduleData?.textAnswers ?? {};
                  const nums = moduleData?.answers ?? {};
                  const any = Object.keys(txt).length + Object.keys(nums).length > 0;
                  if (!any) return null;

                  return (
                    <div key={moduleId} className="mb-4 border border-slate-100 rounded-lg p-3">
                      <h3 className="font-semibold text-sm text-slate-800 mb-2">{moduleId}</h3>
                      {qIds.map(qId => {
                        const def = QUESTION_REGISTRY[qId];
                        const t = txt[qId];
                        const n = nums[qId];
                        if (!t && !n) return null;
                        return (
                          <div key={qId} className="mb-3">
                            <p className="text-xs font-medium text-slate-700">{def?.label ?? qId}</p>
                            {n && <p className="text-sm text-slate-900">{n}</p>}
                            {t && <p className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded p-2 whitespace-pre-wrap">{t}</p>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showPrompt && <GradingPromptModal promptText={promptText} onClose={() => setShowPrompt(false)} />}
    </div>
  );
}
