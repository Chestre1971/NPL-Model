import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, BrainCircuit, Check, CheckCircle2, Copy, Download, RefreshCw, Save, Users, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { loadAllStudentRecords, type StudentRecord } from '../lib/storage';
import { MODULE_QUESTION_ORDER, QUESTION_REGISTRY } from '../lib/questions';
import { buildGradingPrompt } from '../lib/gradingPrompt';

interface StudentAdminRecord extends StudentRecord {
  userId: string;
  email: string;
}

interface SubmissionRow {
  id: string;
  user_id: string;
  module_id: string;
  question_id: string;
  answer_text: string | null;
  answer_numeric: string | null;
}

interface ScoreRow {
  id: string;
  submission_id: string;
  points_awarded: number;
  points_max: number;
  rubric_level: number | null;
  feedback: string | null;
}

interface ScoreDraft {
  rubric_level: number;
  points_awarded: number;
  points_max: number;
  feedback: string;
}

const COMPLETION_MODULES = ['m1b', 'm2', 'm3', 'm4', 'm5'] as const;
const MODULE_SHORT_LABEL: Record<string, string> = {
  m0: 'Brief',
  m1: 'Tape',
  m1b: 'Portfolio',
  m2: 'Baseline',
  m3: 'Recovery',
  m_enf: 'Enforcement',
  m4: 'Resolution',
  m5: 'Financing',
  m_ic: 'IC Memo',
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
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

function csvEscape(value: string | number) {
  const s = String(value ?? '');
  return `"${s.replace(/"/g, '""')}"`;
}

export function AdminPage() {
  const { state, authLoading, userRole } = useApp();
  const [resolvedRole, setResolvedRole] = useState<'student' | 'instructor' | null>(userRole);
  const [resolvedEmail, setResolvedEmail] = useState<string>('');
  const [records, setRecords] = useState<StudentAdminRecord[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, ScoreDraft>>({});
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [savingSubmissionId, setSavingSubmissionId] = useState<string | null>(null);
  const [savingLockModule, setSavingLockModule] = useState<string | null>(null);
  const [promptText, setPromptText] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);

  const isInstructorUser =
    resolvedRole === 'instructor' ||
    (resolvedEmail || state.session?.studentId || '').toLowerCase() === 'ced36@cornell.edu';

  const scoresBySubmission = useMemo(
    () => new Map(scores.map(s => [s.submission_id, s])),
    [scores],
  );

  const studentById = useMemo(
    () => new Map(records.map(r => [r.userId, r])),
    [records],
  );

  const selectedStudent = selectedUserId ? studentById.get(selectedUserId) ?? null : null;

  const submissionsByStudent = useMemo(() => {
    const map = new Map<string, SubmissionRow[]>();
    for (const s of submissions) {
      if (!map.has(s.user_id)) map.set(s.user_id, []);
      map.get(s.user_id)!.push(s);
    }
    return map;
  }, [submissions]);

  const refresh = useCallback(async () => {
    if (!supabase) {
      const fallback = loadAllStudentRecords().map((r, idx) => ({
        ...r,
        userId: r.session.studentId || `local-${idx}`,
        email: r.session.studentId || '',
      }));
      setRecords(fallback);
      setSubmissions([]);
      setScores([]);
      return;
    }
    setLoadingRecords(true);
    setLoadError('');

    const [{ data: states, error: stateErr }, { data: profiles, error: profileErr }, { data: subs, error: subsErr }, { data: scr, error: scoreErr }] = await Promise.all([
      supabase.from('student_states').select('user_id, state_json, updated_at').order('updated_at', { ascending: false }),
      supabase.from('profiles').select('id, email, full_name'),
      supabase.from('submissions').select('id, user_id, module_id, question_id, answer_text, answer_numeric'),
      supabase.from('scores').select('id, submission_id, points_awarded, points_max, rubric_level, feedback'),
    ]);

    const firstErr = stateErr || profileErr || subsErr || scoreErr;
    if (firstErr) {
      setLoadError(firstErr.message);
      setLoadingRecords(false);
      return;
    }

    const profilesById = new Map((profiles ?? []).map(p => [p.id, p]));
    const parsed: StudentAdminRecord[] = (states ?? []).map(row => {
      const payload = (row.state_json ?? {}) as Partial<StudentRecord>;
      const profile = profilesById.get(row.user_id);
      return {
        userId: row.user_id,
        email: profile?.email ?? '',
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
    setSubmissions((subs ?? []) as SubmissionRow[]);
    setScores((scr ?? []) as ScoreRow[]);
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
      if (profile?.role === 'instructor' || profile?.role === 'student') setResolvedRole(profile.role);
      if (profile?.email) setResolvedEmail(profile.email);
    };
    void run();
  }, [state.session]);

  useEffect(() => {
    if (authLoading) return;
    if (state.session && isInstructorUser) void refresh();
  }, [authLoading, state.session, isInstructorUser, refresh]);

  useEffect(() => {
    if (!selectedUserId && records.length > 0) setSelectedUserId(records[0].userId);
  }, [records, selectedUserId]);

  const completionStats = useMemo(() => {
    return COMPLETION_MODULES.map(m => ({
      module: m,
      label: MODULE_SHORT_LABEL[m] ?? m,
      count: records.filter(r => r.modules[m]?.completed).length,
    }));
  }, [records]);

  const openPrompt = useCallback((record: StudentAdminRecord) => {
    const promptRecord: StudentRecord = { session: record.session, modules: record.modules };
    setPromptText(buildGradingPrompt(promptRecord));
    setShowPrompt(true);
  }, []);

  const getDraft = useCallback((submissionId: string): ScoreDraft => {
    const fromState = scoreDrafts[submissionId];
    if (fromState) return fromState;
    const existing = scoresBySubmission.get(submissionId);
    return {
      rubric_level: existing?.rubric_level ?? 0,
      points_awarded: existing?.points_awarded ?? 0,
      points_max: existing?.points_max ?? 3,
      feedback: existing?.feedback ?? '',
    };
  }, [scoreDrafts, scoresBySubmission]);

  const updateDraft = useCallback((submissionId: string, patch: Partial<ScoreDraft>) => {
    setScoreDrafts(prev => {
      const cur = getDraft(submissionId);
      return { ...prev, [submissionId]: { ...cur, ...patch } };
    });
  }, [getDraft]);

  const saveScore = useCallback(async (submissionId: string) => {
    if (!supabase) return;
    const draft = getDraft(submissionId);
    const { data: userData } = await supabase.auth.getUser();
    const graderId = userData.user?.id ?? null;
    setSavingSubmissionId(submissionId);
    const { data, error } = await supabase
      .from('scores')
      .upsert({
        submission_id: submissionId,
        grader_user_id: graderId,
        points_awarded: draft.points_awarded,
        points_max: draft.points_max,
        rubric_level: draft.rubric_level,
        feedback: draft.feedback || null,
      }, { onConflict: 'submission_id' })
      .select('id, submission_id, points_awarded, points_max, rubric_level, feedback')
      .single();
    setSavingSubmissionId(null);
    if (error) {
      setLoadError(error.message);
      return;
    }
    setScores(prev => {
      const rest = prev.filter(s => s.submission_id !== submissionId);
      return [...rest, data as ScoreRow];
    });
  }, [getDraft]);

  const setModuleLockForStudent = useCallback(async (
    student: StudentAdminRecord,
    moduleId: string,
    locked: boolean,
  ) => {
    if (!supabase) return;
    setSavingLockModule(moduleId);
    const nextState = {
      session: student.session,
      modules: {
        ...student.modules,
        [moduleId]: {
          ...(student.modules[moduleId as keyof StudentRecord['modules']] ?? {}),
          locked,
          completed: locked ? true : false,
        },
      },
    };

    const { error } = await supabase
      .from('student_states')
      .update({ state_json: nextState, updated_at: new Date().toISOString() })
      .eq('user_id', student.userId);

    setSavingLockModule(null);
    if (error) {
      setLoadError(error.message);
      return;
    }

    setRecords(prev => prev.map(r => {
      if (r.userId !== student.userId) return r;
      return {
        ...r,
        modules: nextState.modules as StudentRecord['modules'],
      };
    }));
  }, []);

  const studentModuleStats = useMemo(() => {
    const out: Record<string, { awarded: number; max: number; graded: number; total: number; status: 'graded' | 'ungraded' | 'not_started' }> = {};
    if (!selectedStudent) return out;
    const rows = submissionsByStudent.get(selectedStudent.userId) ?? [];
    for (const [moduleId, qIds] of Object.entries(MODULE_QUESTION_ORDER)) {
      const answered = rows.filter(r => r.module_id === moduleId && qIds.includes(r.question_id));
      const scored = answered.filter(r => scoresBySubmission.has(r.id));
      const awarded = scored.reduce((s, r) => s + (scoresBySubmission.get(r.id)?.points_awarded ?? 0), 0);
      const max = scored.reduce((s, r) => s + (scoresBySubmission.get(r.id)?.points_max ?? 0), 0);
      const status: 'graded' | 'ungraded' | 'not_started' =
        answered.length === 0 ? 'not_started' : scored.length === answered.length ? 'graded' : 'ungraded';
      out[moduleId] = { awarded, max, graded: scored.length, total: answered.length, status };
    }
    return out;
  }, [selectedStudent, submissionsByStudent, scoresBySubmission]);

  const overallRollup = useMemo(() => {
    if (!selectedStudent) return { awarded: 0, max: 0 };
    return Object.values(studentModuleStats).reduce(
      (acc, m) => ({ awarded: acc.awarded + m.awarded, max: acc.max + m.max }),
      { awarded: 0, max: 0 },
    );
  }, [selectedStudent, studentModuleStats]);

  const exportCsv = useCallback(() => {
    const modules = Object.keys(MODULE_QUESTION_ORDER);
    const header = ['student_name', 'student_email', ...modules.flatMap(m => [`${m}_awarded`, `${m}_max`, `${m}_status`]), 'overall_awarded', 'overall_max'];
    const lines = [header.map(csvEscape).join(',')];

    for (const student of records) {
      const rows = submissionsByStudent.get(student.userId) ?? [];
      let overallAwarded = 0;
      let overallMax = 0;
      const moduleCells: Array<string | number> = [];

      for (const m of modules) {
        const qIds = MODULE_QUESTION_ORDER[m];
        const answered = rows.filter(r => r.module_id === m && qIds.includes(r.question_id));
        const scored = answered.filter(r => scoresBySubmission.has(r.id));
        const awarded = scored.reduce((s, r) => s + (scoresBySubmission.get(r.id)?.points_awarded ?? 0), 0);
        const max = scored.reduce((s, r) => s + (scoresBySubmission.get(r.id)?.points_max ?? 0), 0);
        const status = answered.length === 0 ? 'not_started' : scored.length === answered.length ? 'graded' : 'ungraded';
        moduleCells.push(awarded, max, status);
        overallAwarded += awarded;
        overallMax += max;
      }

      const row = [student.session.name, student.email || student.session.studentId, ...moduleCells, overallAwarded, overallMax];
      lines.push(row.map(csvEscape).join(','));
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `npl_gradebook_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [records, submissionsByStudent, scoresBySubmission]);

  if (authLoading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600">Loading...</div>;
  if (!state.session) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-700">Sign in first at <a className="ml-1 underline" href="/">/</a>.</div>;
  if (!isInstructorUser) {
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
        <div className="flex items-center gap-3">
          <button onClick={exportCsv} className="flex items-center gap-1 text-xs text-blue-300 hover:text-white">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => void refresh()} className="flex items-center gap-1 text-xs text-blue-300 hover:text-white">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
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
              {records.map(r => {
                const rows = submissionsByStudent.get(r.userId) ?? [];
                const scored = rows.filter(s => scoresBySubmission.has(s.id));
                const awarded = scored.reduce((sum, s) => sum + (scoresBySubmission.get(s.id)?.points_awarded ?? 0), 0);
                const max = scored.reduce((sum, s) => sum + (scoresBySubmission.get(s.id)?.points_max ?? 0), 0);
                return (
                  <button
                    key={r.userId}
                    onClick={() => setSelectedUserId(r.userId)}
                    className={`w-full text-left p-3 rounded-xl border ${selectedUserId === r.userId ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-slate-900">{r.session.name}</span>
                      <span className="text-xs text-slate-400">{r.email || r.session.studentId}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      {COMPLETION_MODULES.map(m => (
                        <span key={m} className="inline-flex items-center gap-1">
                          {MODULE_SHORT_LABEL[m]}
                          {r.modules[m]?.completed ? <CheckCircle2 size={12} className="text-green-500" /> : <span className="text-slate-300">-</span>}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">Scored: {awarded.toFixed(1)} / {max.toFixed(1)}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2">
            {!selectedStudent ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400">Select a student</div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{selectedStudent.session.name}</h2>
                    <p className="text-sm text-slate-500">{selectedStudent.email || selectedStudent.session.studentId}</p>
                  </div>
                  <button onClick={() => openPrompt(selectedStudent)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg">
                    <BrainCircuit size={13} /> Grade with AI
                  </button>
                </div>

                <div className="mb-4 border border-slate-100 rounded-lg p-3 bg-slate-50">
                  <div className="text-xs text-slate-600 mb-2">Section Roll-up</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(studentModuleStats).map(([moduleId, stat]) => (
                      <div key={moduleId} className="bg-white border border-slate-200 rounded p-2">
                        <div className="text-xs font-semibold text-slate-700">{MODULE_SHORT_LABEL[moduleId] ?? moduleId}</div>
                        <div className="text-xs text-slate-600">{stat.awarded.toFixed(1)} / {stat.max.toFixed(1)}</div>
                        <div className={`text-[11px] ${stat.status === 'graded' ? 'text-green-700' : stat.status === 'ungraded' ? 'text-amber-700' : 'text-slate-500'}`}>
                          {stat.status} ({stat.graded}/{stat.total})
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-800">Overall: {overallRollup.awarded.toFixed(1)} / {overallRollup.max.toFixed(1)}</div>
                </div>

                {Object.entries(MODULE_QUESTION_ORDER).map(([moduleId, qIds]) => {
                  const moduleRows = (submissionsByStudent.get(selectedStudent.userId) ?? []).filter(r => r.module_id === moduleId && qIds.includes(r.question_id));
                  if (moduleRows.length === 0) return null;
                  const stat = studentModuleStats[moduleId] ?? { status: 'not_started', graded: 0, total: 0, awarded: 0, max: 0 };

                  return (
                    <div key={moduleId} className="mb-4 border border-slate-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-sm text-slate-800">{MODULE_SHORT_LABEL[moduleId] ?? moduleId}</h3>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${stat.status === 'graded' ? 'text-green-700' : stat.status === 'ungraded' ? 'text-amber-700' : 'text-slate-500'}`}>
                            {stat.status} ({stat.graded}/{stat.total})
                          </span>
                          {selectedStudent && (
                            <button
                              onClick={() => void setModuleLockForStudent(
                                selectedStudent,
                                moduleId,
                                !(selectedStudent.modules[moduleId as keyof StudentRecord['modules']]?.locked ?? false),
                              )}
                              disabled={savingLockModule === moduleId}
                              className="text-xs px-2 py-1 rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                            >
                              {savingLockModule === moduleId
                                ? 'Saving...'
                                : (selectedStudent.modules[moduleId as keyof StudentRecord['modules']]?.locked ?? false)
                                  ? 'Unlock for Resubmission'
                                  : 'Lock Module'}
                            </button>
                          )}
                        </div>
                      </div>

                      {qIds.map(qId => {
                        const submission = moduleRows.find(r => r.question_id === qId);
                        if (!submission) return null;
                        const def = QUESTION_REGISTRY[qId];
                        const answer = submission.answer_text || submission.answer_numeric || '';
                        const draft = getDraft(submission.id);
                        return (
                          <div key={submission.id} className="mb-3 border border-slate-100 rounded p-2">
                            <p className="text-xs font-medium text-slate-700 mb-1">{def?.label ?? qId}</p>
                            <p className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded p-2 whitespace-pre-wrap mb-2">{answer || '(no answer)'}</p>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-start">
                              <label className="text-xs">
                                <span className="block text-slate-600 mb-1">Rubric (0-3)</span>
                                <select
                                  value={draft.rubric_level}
                                  onChange={e => {
                                    const level = Number(e.target.value);
                                    updateDraft(submission.id, { rubric_level: level, points_awarded: level });
                                  }}
                                  className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                                >
                                  <option value={0}>0</option>
                                  <option value={1}>1</option>
                                  <option value={2}>2</option>
                                  <option value={3}>3</option>
                                </select>
                              </label>

                              <label className="text-xs">
                                <span className="block text-slate-600 mb-1">Points</span>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={draft.points_awarded}
                                  onChange={e => updateDraft(submission.id, { points_awarded: Number(e.target.value) })}
                                  className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                                />
                              </label>

                              <label className="text-xs">
                                <span className="block text-slate-600 mb-1">Max</span>
                                <input
                                  type="number"
                                  step="0.5"
                                  value={draft.points_max}
                                  onChange={e => updateDraft(submission.id, { points_max: Number(e.target.value) })}
                                  className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                                />
                              </label>

                              <button
                                onClick={() => void saveScore(submission.id)}
                                disabled={savingSubmissionId === submission.id}
                                className="mt-5 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded disabled:opacity-60"
                              >
                                <Save size={12} /> {savingSubmissionId === submission.id ? 'Saving...' : 'Save'}
                              </button>
                            </div>

                            <label className="text-xs block mt-2">
                              <span className="block text-slate-600 mb-1">Feedback</span>
                              <textarea
                                value={draft.feedback}
                                onChange={e => updateDraft(submission.id, { feedback: e.target.value })}
                                rows={2}
                                className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                              />
                            </label>
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
