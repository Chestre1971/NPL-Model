/**
 * Grading prompt builder — Option A (copy-paste workflow).
 *
 * Generates a formatted text block the instructor copies and pastes into Claude.ai
 * (or another LLM) to grade a student's text answers.
 *
 * Only text questions are included — numeric answers are auto-checked in the app.
 * Questions with no answer are skipped.
 */

import type { StudentRecord } from './storage';
import { QUESTION_REGISTRY, MODULE_QUESTION_ORDER } from './questions';

const MODULE_LABELS: Record<string, string> = {
  m0:    'Deal Brief',
  m1:    'Loan Tape + Summary',
  m1b:   'Portfolio Stratification',
  m2:    'Performing Baseline',
  m3:    'Recovery Analysis',
  m_enf: 'Enforcement',
  m4:    'Active Resolution',
  m5:    'Loan-on-Loan Financing',
  m_ic:  'IC Memo',
};

const GRADING_INSTRUCTIONS = `
GRADING INSTRUCTIONS — Score each text response on a 0–3 scale:

  0 = Missing, off-topic, or completely incorrect
  1 = Partially correct — relevant concept present but key aspects incomplete or imprecise
  2 = Largely correct — key concepts addressed, minor gaps or imprecision only
  3 = Complete — all key concepts present with accurate causal reasoning

For each question provide exactly:
  SCORE: [0–3]
  STRENGTHS: [what the student got right — 1–2 sentences]
  GAPS: [what is missing or incorrect — 1–2 sentences; write "None" if score = 3]

Important grading notes:
- Award marks for accurate causal reasoning ("because X causes Y"), not just keyword presence
- A correct conclusion with no mechanism is worth at most 2/3
- Penalise vague answers that could apply to any NPL portfolio
- Give full credit for any correct terminology synonymous with the model answer
- Do NOT deduct marks for brevity if all key points are present
`.trim();

const CONTEXT_PREAMBLE = `
CONTEXT FOR GRADER:

Cornell REAL 6595 — Private Equity Real Estate & Debt (graduate course).
Students are acting as analysts at Heron Capital underwriting a portfolio of 302
non-performing loans (NPL) totalling ~$1.9bn, being sold by Metropolitan Bank.
Heron's target return is 12.5% unlevered IRR. The assignment progresses from Deal Brief (M0),
Loan Tape + Summary checkpoints (M1), Portfolio Composition (M1b), Performing Baseline (M2),
Recovery Analysis (M3), D-loan Enforcement (M_ENF), Active Resolution A-sale/B-cure/C-DPO (M4),
Loan-on-Loan financing (M5), and a synthesis IC Memo (M_IC). Students use an interactive web model.

Key course concepts: LTV risk buckets (A ≤70%, B 71–85%, C 86–100%, D >100%),
judicial vs. non-judicial enforcement, discounted payoff (DPO), performing baseline,
IRR vs. MoIC trade-offs, positive/negative leverage, release pricing mechanics.
`.trim();

/**
 * Build the grading prompt for a single student.
 *
 * @param record    Student record from localStorage
 * @param modules   Optional array of module IDs to include (default: all)
 * @returns         Formatted text ready for Claude.ai
 */
export function buildGradingPrompt(
  record: StudentRecord,
  modules?: string[],
): string {
  const targetModules = modules ?? Object.keys(MODULE_QUESTION_ORDER);

  const lines: string[] = [];

  // ── Header ──
  lines.push('═'.repeat(64));
  lines.push('GRADING REQUEST — Cornell REAL 6595: NPL Underwriting Assignment');
  lines.push('═'.repeat(64));
  lines.push('');
  lines.push(`Student:      ${record.session.name}`);
  lines.push(`ID:           ${record.session.studentId}`);
  lines.push(`Started:      ${new Date(record.session.startedAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}`);
  lines.push(`Last active:  ${new Date(record.session.lastActive).toLocaleDateString('en-US', { dateStyle: 'medium' })}`);
  lines.push('');

  // ── Context ──
  lines.push(CONTEXT_PREAMBLE);
  lines.push('');
  lines.push(GRADING_INSTRUCTIONS);
  lines.push('');
  lines.push('═'.repeat(64));
  lines.push('');

  let totalTextQuestions = 0;
  let answeredTextQuestions = 0;

  // ── Per-module blocks ──
  for (const modId of targetModules) {
    const mod = record.modules[modId as keyof typeof record.modules];
    if (!mod) continue;

    const textAnswers = mod.textAnswers ?? {};
    const orderedIds = MODULE_QUESTION_ORDER[modId] ?? [];

    // Collect text questions that have been answered
    const answeredTextIds = orderedIds.filter(qId => {
      const def = QUESTION_REGISTRY[qId];
      return def?.type === 'text' && textAnswers[qId]?.trim();
    });

    // Count totals
    const allTextIds = orderedIds.filter(qId => QUESTION_REGISTRY[qId]?.type === 'text');
    totalTextQuestions += allTextIds.length;
    answeredTextQuestions += answeredTextIds.length;

    if (answeredTextIds.length === 0) continue;

    const modLabel = MODULE_LABELS[modId] ?? modId.toUpperCase();
    const completedBadge = mod.completed ? ' [SUBMITTED]' : ' [IN PROGRESS]';

    lines.push(`▌ MODULE: ${modLabel}${completedBadge}`);
    lines.push('─'.repeat(64));
    lines.push('');

    for (const qId of answeredTextIds) {
      const def = QUESTION_REGISTRY[qId];
      const studentAnswer = textAnswers[qId] ?? '';

      lines.push(`Q: ${def?.label ?? qId}`);
      lines.push('');
      lines.push('MODEL ANSWER:');
      lines.push(def?.modelAnswer ?? '(no model answer in registry)');
      lines.push('');

      if (def?.rubric) {
        lines.push('RUBRIC CRITERIA:');
        lines.push(def.rubric);
        lines.push('');
      }

      lines.push('STUDENT ANSWER:');
      lines.push(studentAnswer.trim() || '(no answer entered)');
      lines.push('');
      lines.push('─'.repeat(48));
      lines.push('');
    }

    lines.push('');
  }

  // ── Summary footer ──
  lines.push('═'.repeat(64));
  lines.push(`SUMMARY: ${answeredTextQuestions} of ${totalTextQuestions} text questions answered.`);
  lines.push('Numeric answers are auto-graded in the app and not included here.');
  lines.push('');
  lines.push('Please provide a SCORE (0–3), STRENGTHS, and GAPS for each question above.');
  lines.push('You may also provide an OVERALL COMMENT at the end if useful.');
  lines.push('═'.repeat(64));

  return lines.join('\n');
}

/**
 * Build a short "overview only" summary of which modules the student completed
 * and how many questions they answered, without the full prompt content.
 */
export function buildStudentSummary(record: StudentRecord): string {
  const lines: string[] = [];
  lines.push(`${record.session.name} (${record.session.studentId})`);
  lines.push('');

  for (const [modId, qOrder] of Object.entries(MODULE_QUESTION_ORDER)) {
    const mod = record.modules[modId as keyof typeof record.modules];
    if (!mod) continue;

    const textTotal = qOrder.filter(id => QUESTION_REGISTRY[id]?.type === 'text').length;
    const textAnswered = qOrder.filter(id => {
      return QUESTION_REGISTRY[id]?.type === 'text' && mod.textAnswers?.[id]?.trim();
    }).length;
    const numTotal = qOrder.filter(id => QUESTION_REGISTRY[id]?.type === 'numeric').length;
    const numAnswered = qOrder.filter(id => {
      return QUESTION_REGISTRY[id]?.type === 'numeric' && mod.answers?.[id] !== undefined;
    }).length;

    const label = MODULE_LABELS[modId] ?? modId;
    const status = mod.completed ? '✓' : '·';
    lines.push(`  ${status} ${label}: ${textAnswered}/${textTotal} text, ${numAnswered}/${numTotal} numeric`);
  }

  return lines.join('\n');
}
