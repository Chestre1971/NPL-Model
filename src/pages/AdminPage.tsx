import { useState, useMemo, useEffect, useCallback } from 'react';
import { loadAllStudentRecords, type StudentRecord } from '../lib/storage';
import { Lock, RefreshCw, Users, CheckCircle2, BookOpen, ChevronDown, ChevronRight, NotebookPen, Trash2, Plus, BrainCircuit, Copy, X, Check } from 'lucide-react';
import { QUESTION_REGISTRY, MODULE_QUESTION_ORDER } from '../lib/questions';
import { buildGradingPrompt } from '../lib/gradingPrompt';

// ── Change Log ────────────────────────────────────────────────────────────────
const LOG_KEY = 'npl_admin_change_log';

interface LogEntry {
  id: string;
  timestamp: string;
  text: string;
}

function loadLog(): LogEntry[] {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]'); } catch { return []; }
}
function saveLog(entries: LogEntry[]) {
  localStorage.setItem(LOG_KEY, JSON.stringify(entries));
}

function ChangeLogPanel() {
  const [entries, setEntries] = useState<LogEntry[]>(loadLog);
  const [draft, setDraft] = useState('');

  const addEntry = () => {
    const text = draft.trim();
    if (!text) return;
    const next = [
      { id: crypto.randomUUID(), timestamp: new Date().toISOString(), text },
      ...entries,
    ];
    setEntries(next);
    saveLog(next);
    setDraft('');
  };

  const deleteEntry = (id: string) => {
    const next = entries.filter(e => e.id !== id);
    setEntries(next);
    saveLog(next);
  };

  return (
    <div className="mt-8 border border-slate-200 rounded-xl bg-white overflow-hidden">
      <div className="flex items-center gap-2 bg-slate-50 px-5 py-3 border-b border-slate-200">
        <NotebookPen size={16} className="text-blue-600" />
        <h2 className="font-semibold text-slate-800">Assignment Notes & Change Log</h2>
        <span className="text-xs text-slate-400 ml-auto">{entries.length} {entries.length === 1 ? 'entry' : 'entries'} · stored locally</span>
      </div>

      {/* New entry */}
      <div className="px-5 py-4 border-b border-slate-100">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addEntry(); }}
          placeholder="Type a note, planned change, or todo… (Ctrl+Enter to save)"
          rows={3}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={addEntry}
            disabled={!draft.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-800 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 disabled:cursor-default transition-colors"
          >
            <Plus size={13} /> Add Note
          </button>
        </div>
      </div>

      {/* Entries */}
      <div className="px-5 py-3 space-y-3 max-h-[500px] overflow-y-auto">
        {entries.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">No notes yet — add your first entry above.</p>
        )}
        {entries.map(e => (
          <div key={e.id} className="flex gap-3 group">
            <div className="flex-1 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5">
              <p className="text-xs text-slate-400 mb-1">
                {new Date(e.timestamp).toLocaleString('en-US', {
                  dateStyle: 'medium', timeStyle: 'short',
                })}
              </p>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{e.text}</p>
            </div>
            <button
              onClick={() => deleteEntry(e.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity self-start mt-2 text-slate-300 hover:text-red-500"
              title="Delete entry"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Grading Prompt Modal ───────────────────────────────────────────────────────

function GradingPromptModal({ promptText, onClose }: { promptText: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(promptText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      // Fallback for environments without clipboard API
      const el = document.createElement('textarea');
      el.value = promptText;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }, [promptText]);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <BrainCircuit size={18} className="text-blue-600" />
            <h2 className="font-bold text-slate-900">AI Grading Prompt</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* Instructions */}
        <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 shrink-0">
          <p className="text-xs text-blue-800">
            <strong>How to use:</strong> Copy this prompt, open{' '}
            <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="underline">claude.ai</a>
            {' '}(or another AI), paste it, and send. The AI will grade each text question
            and return scores with feedback. Numeric answers are auto-checked in the app and not included.
          </p>
        </div>

        {/* Prompt text */}
        <div className="flex-1 overflow-hidden px-5 py-4">
          <textarea
            readOnly
            value={promptText}
            className="w-full h-full border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-700 resize-none focus:outline-none bg-slate-50"
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between shrink-0">
          <p className="text-xs text-slate-400">
            {promptText.split('\n').length} lines · {(promptText.length / 1000).toFixed(1)}k chars
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg"
            >
              Close
            </button>
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors
                ${copied
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-700 hover:bg-blue-800 text-white'}`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Prompt'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? 'cornell2025';

const ALL_MODULES = ['m1', 'm1b', 'm2', 'm3', 'm4', 'm5'] as const;
const MODULE_LABELS_MAP: Record<string, string> = {
  m1:  'Portfolio Composition',
  m1b: 'Portfolio Composition',
  m2:  'Performing Baseline',
  m3:  'Recovery Analysis',
  m4:  'Active Resolution',
  m5:  'Financing',
};
// Short labels for stat cards (≤12 chars)
const MODULE_SHORT_LABEL: Record<string, string> = {
  m1b: 'Portfolio',
  m2:  'Baseline',
  m3:  'Recovery',
  m4:  'Resolution',
  m5:  'Financing',
};
// Modules that have a Submit / Mark Complete button — shown in completion stats
const COMPLETION_MODULES = ['m1b', 'm2', 'm3', 'm4', 'm5'] as const;

function ProgressBadge({ completed }: { completed: boolean }) {
  return completed
    ? <CheckCircle2 size={14} className="text-green-500" />
    : <span className="text-xs text-slate-300">—</span>;
}

function RubricBlock({ modelAnswer, rubric }: { modelAnswer: string; rubric?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 px-2 py-0.5 border border-slate-200 rounded"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {open ? 'Hide model answer' : 'Show model answer'}
      </button>
      {open && (
        <div className="mt-1 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-900 whitespace-pre-wrap">
          {modelAnswer}
          {rubric && (
            <div className="mt-2 pt-2 border-t border-green-200 text-green-700">
              <strong>Rubric:</strong> {rubric}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AdminPage() {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(true);
  const [error, setError] = useState('');
  const [records, setRecords] = useState<StudentRecord[]>([]);
  const [selected, setSelected] = useState<StudentRecord | null>(null);
  const [gradingPromptText, setGradingPromptText] = useState('');
  const [showGradingModal, setShowGradingModal] = useState(false);

  const handleGeneratePrompt = useCallback((record: StudentRecord) => {
    const prompt = buildGradingPrompt(record);
    setGradingPromptText(prompt);
    setShowGradingModal(true);
  }, []);

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthed(true);
      setRecords(loadAllStudentRecords());
    } else {
      setError('Incorrect password.');
    }
  };

  useEffect(() => { setRecords(loadAllStudentRecords()); }, []);
  const refresh = () => setRecords(loadAllStudentRecords());

  const completionStats = useMemo(() => {
    return COMPLETION_MODULES.map(m => ({
      module: m,
      label: MODULE_SHORT_LABEL[m] ?? m.toUpperCase(),
      count: records.filter(r => r.modules[m]?.completed).length,
    }));
  }, [records]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <Lock size={20} className="text-slate-600" />
            <h1 className="text-xl font-bold text-slate-900">Professor Dashboard</h1>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Admin Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter admin password"
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              onClick={handleLogin}
              className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold rounded-lg py-2.5 text-sm"
            >
              Access Dashboard
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-4 text-center">
            Set VITE_ADMIN_PASSWORD in .env to change the password.
          </p>
          <div className="mt-4 pt-4 border-t border-slate-100 text-center">
            <a href="/" className="text-xs text-slate-400 hover:text-slate-600">← Back to student app</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-blue-950 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen size={20} className="text-amber-400" />
          <div>
            <h1 className="font-bold">Professor Dashboard</h1>
            <p className="text-xs text-blue-300">NPL Underwriting Model — Cornell REAL 6595</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={refresh} className="flex items-center gap-1 text-xs text-blue-300 hover:text-white">
            <RefreshCw size={14} /> Refresh
          </button>
          <a href="/" className="text-xs text-blue-300 hover:text-white">← Student App</a>
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Stats */}
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
              <p className="text-xs text-slate-400">
                {records.length > 0 ? Math.round(s.count / records.length * 100) : 0}% submitted
              </p>
            </div>
          ))}
        </div>

        {/* Student list + Detail panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Student list */}
          <div className="lg:col-span-1">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">Students ({records.length})</h2>
            <div className="space-y-2">
              {records.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-400">
                  No student sessions found yet.<br />Sessions are saved per-browser via localStorage.
                </div>
              )}
              {records.map(r => (
                <button
                  key={r.session.studentId}
                  onClick={() => setSelected(r)}
                  className={`w-full text-left p-3 rounded-xl border transition-colors
                    ${selected?.session.studentId === r.session.studentId
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-slate-900">{r.session.name}</span>
                    <span className="text-xs text-slate-400">{r.session.studentId}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {COMPLETION_MODULES.map(m => (
                      <span key={m} className="flex items-center gap-0.5">
                        {MODULE_SHORT_LABEL[m] ?? m.toUpperCase()}
                        <ProgressBadge completed={r.modules[m]?.completed ?? false} />
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Last active: {new Date(r.session.lastActive).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2">
            {!selected ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400">
                Select a student to see their answers
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-start justify-between mb-1">
                  <h2 className="text-lg font-bold text-slate-900">{selected.session.name}</h2>
                  <button
                    onClick={() => handleGeneratePrompt(selected)}
                    title="Generate AI grading prompt for this student"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition-colors shrink-0 ml-2"
                  >
                    <BrainCircuit size={13} />
                    Grade with AI
                  </button>
                </div>
                <p className="text-sm text-slate-500 mb-4">
                  ID: {selected.session.studentId} · Started: {new Date(selected.session.startedAt).toLocaleDateString()}
                </p>

                {ALL_MODULES.map(m => {
                  const mod = selected.modules[m];
                  const numericAnswers = mod?.answers ?? {};
                  const textAnswers = mod?.textAnswers ?? {};
                  const hasAnswers = Object.keys(numericAnswers).length > 0 || Object.keys(textAnswers).length > 0;

                  // Build ordered question list for this module
                  const orderedIds = MODULE_QUESTION_ORDER[m] ?? [];
                  // Also collect any answered questionIds not in the order list (legacy/unknown)
                  const allAnsweredIds = new Set([
                    ...Object.keys(numericAnswers),
                    ...Object.keys(textAnswers),
                  ]);
                  const extraIds = [...allAnsweredIds].filter(id => !orderedIds.includes(id));

                  return (
                    <div key={m} className="mb-5 border border-slate-100 rounded-lg overflow-hidden">
                      {/* Module header */}
                      <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 border-b border-slate-100">
                        <h3 className="font-semibold text-slate-800 text-sm">{MODULE_LABELS_MAP[m] ?? m.toUpperCase()}</h3>
                        {mod?.completed && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Complete</span>
                        )}
                        {!hasAnswers && (
                          <span className="text-xs text-slate-400 ml-auto">No answers submitted</span>
                        )}
                      </div>

                      <div className="px-4 py-3 space-y-4">
                        {/* Render questions in registry order */}
                        {orderedIds.map(qId => {
                          const def = QUESTION_REGISTRY[qId];
                          const numAns = numericAnswers[qId];
                          const txtAns = textAnswers[qId];
                          if (!numAns && !txtAns) return null; // not answered yet

                          if (def?.type === 'numeric' && numAns !== undefined) {
                            return (
                              <div key={qId} className="border-b border-slate-50 pb-2">
                                <p className="text-xs text-slate-500 mb-0.5">{def.label}</p>
                                <p className="text-sm font-semibold text-slate-900">{numAns}</p>
                                <p className="text-xs text-slate-400">{def.modelAnswer}</p>
                              </div>
                            );
                          }

                          if ((def?.type === 'text' || !def) && txtAns !== undefined) {
                            return (
                              <div key={qId}>
                                <p className="text-xs font-medium text-slate-700 mb-1">
                                  {def?.label ?? qId}
                                </p>
                                <div className="text-xs text-slate-700 bg-slate-50 rounded p-3 max-h-40 overflow-y-auto whitespace-pre-wrap border border-slate-100">
                                  {txtAns || <span className="text-slate-400 italic">No answer entered</span>}
                                </div>
                                {def && (
                                  <RubricBlock modelAnswer={def.modelAnswer} rubric={def.rubric} />
                                )}
                              </div>
                            );
                          }

                          return null;
                        })}

                        {/* Legacy/unknown question IDs */}
                        {extraIds.length > 0 && (
                          <div className="pt-2 border-t border-slate-100">
                            <p className="text-xs text-slate-400 italic mb-2">Other submitted answers:</p>
                            {extraIds.map(qId => {
                              const numAns = numericAnswers[qId];
                              const txtAns = textAnswers[qId];
                              return (
                                <div key={qId} className="mb-2">
                                  <p className="text-xs font-mono text-slate-400">{qId}</p>
                                  {numAns && <p className="text-sm font-medium">{numAns}</p>}
                                  {txtAns && (
                                    <p className="text-xs text-slate-600 bg-slate-50 rounded p-2 max-h-20 overflow-y-auto">
                                      {txtAns}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {!hasAnswers && (
                          <p className="text-xs text-slate-300 text-center py-2">—</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <ChangeLogPanel />
      </div>

      {showGradingModal && (
        <GradingPromptModal
          promptText={gradingPromptText}
          onClose={() => setShowGradingModal(false)}
        />
      )}
    </div>
  );
}
