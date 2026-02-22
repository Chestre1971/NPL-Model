import { CheckCircle, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { QUESTION_REGISTRY } from '../../lib/questions';

interface AnswerInputProps {
  questionId: string;
  module: 'm0' | 'm1' | 'm1b' | 'm2' | 'm3' | 'm_enf' | 'm4' | 'm5' | 'm_ic';
  label: string;
  modelAnswer: string | number;
  tolerance?: number;     // e.g. 0.001 for 0.1% tolerance
  format?: 'pct' | 'currency' | 'number' | 'text';
  hint?: string;
  checkMode?: 'exact' | 'range' | 'reveal'; // default 'exact'
}

export function AnswerInput({
  questionId, module, label, modelAnswer, tolerance = 0.01,
  format = 'number', hint, checkMode = 'exact',
}: AnswerInputProps) {
  const { state, dispatch } = useApp();
  const studentAnswer = state.modules[module]?.answers?.[questionId] ?? '';

  const handleChange = (val: string) => {
    dispatch({ type: 'SET_ANSWER', module, questionId, answer: val });
  };

  const parseAnswer = (s: string): number | null => {
    const cleaned = s.replace(/[$,%xm\s]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  };

  const normalizeModelAnswer = (): number => {
    if (typeof modelAnswer === 'number') return modelAnswer;
    const n = parseAnswer(String(modelAnswer));
    return n ?? 0;
  };

  const checkAnswer = (): 'correct' | 'wrong' | 'unanswered' => {
    if (!studentAnswer) return 'unanswered';
    if (checkMode === 'reveal') return 'unanswered';
    const student = parseAnswer(studentAnswer);
    if (student === null) return 'wrong';
    const model = normalizeModelAnswer();
    const diff = Math.abs(student - model);
    const relDiff = model !== 0 ? diff / Math.abs(model) : diff;
    return relDiff <= tolerance ? 'correct' : 'wrong';
  };

  const status = checkAnswer();

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-500 mb-1">{hint}</p>}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={studentAnswer}
          onChange={e => handleChange(e.target.value)}
          placeholder={format === 'pct' ? 'e.g. 12.00%' : format === 'currency' ? 'e.g. $1,679.3m' : 'Enter answer'}
          className={`border rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-400
            ${status === 'correct' ? 'answer-correct' : status === 'wrong' ? 'answer-wrong' : 'border-slate-300'}`}
        />
        {status === 'correct' && <CheckCircle className="text-green-600" size={18} />}
        {status === 'wrong' && <XCircle className="text-red-500" size={18} />}
      </div>
    </div>
  );
}

/** Qualitative (free-text) answer box */
interface TextAnswerProps {
  questionId: string;
  module: 'm0' | 'm1' | 'm1b' | 'm2' | 'm3' | 'm_enf' | 'm4' | 'm5' | 'm_ic';
  label: string;
  rows?: number;
}

export function TextAnswerInput({ questionId, module, label, rows = 4 }: TextAnswerProps) {
  const { state, dispatch } = useApp();
  const studentAnswer = state.modules[module]?.textAnswers?.[questionId] ?? '';
  const modelAnswer = QUESTION_REGISTRY[questionId]?.modelAnswer;
  const rubric = QUESTION_REGISTRY[questionId]?.rubric;

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <textarea
        rows={rows}
        value={studentAnswer}
        onChange={e => dispatch({ type: 'SET_TEXT_ANSWER', module, questionId, answer: e.target.value })}
        placeholder="Type your answer here..."
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
      />
      {modelAnswer && (
        <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <p className="text-xs font-semibold text-emerald-700 mb-1">Model Answer</p>
          <p className="text-xs text-emerald-900 whitespace-pre-wrap leading-relaxed">{modelAnswer}</p>
        </div>
      )}
      {rubric && (
        <div className="mt-1.5 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs font-semibold text-blue-700 mb-1">Grading Rubric</p>
          <p className="text-xs text-blue-900 whitespace-pre-wrap leading-relaxed">{rubric}</p>
        </div>
      )}
    </div>
  );
}
