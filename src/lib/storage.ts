/**
 * Persistence layer using localStorage.
 * Stubbed for future Firebase replacement — just swap the adapter functions.
 */

export interface StudentSession {
  studentId: string;
  name: string;
  startedAt: string;
  lastActive: string;
}

export interface ModuleProgress {
  completed: boolean;
  answers: Record<string, string>;  // questionId -> student's answer
  textAnswers: Record<string, string>; // questionId -> free-text answer
  assumptions: Record<string, number>; // assumption key -> value
}

/** Per-loan editable overrides (keyed by loanId). Only changed fields are stored. */
export interface LoanOverride {
  amount?: number;
  coupon?: number;
  collateralValue?: number;
  maturity?: string;
  jurisdiction?: string;
}

export interface AppState {
  session: StudentSession | null;
  modules: {
    m0: ModuleProgress;
    m1: ModuleProgress;
    m1b: ModuleProgress;
    m2: ModuleProgress;
    m3: ModuleProgress;
    m_enf: ModuleProgress;   // Enforcement (D-loans) — between Recovery Analysis and Active Resolution
    m4: ModuleProgress;
    m5: ModuleProgress;
    m_ic: ModuleProgress;    // IC Memo — mandatory synthesis capstone
  };
  loanOverrides: Record<string, LoanOverride>;
}

const STORAGE_KEY = 'npl_model_state';

function defaultModule(): ModuleProgress {
  return { completed: false, answers: {}, textAnswers: {}, assumptions: {} };
}

function defaultState(): AppState {
  return {
    session: null,
    modules: {
      m0: defaultModule(),
      m1: defaultModule(),
      m1b: defaultModule(),
      m2: defaultModule(),
      m3: defaultModule(),
      m_enf: defaultModule(),
      m4: defaultModule(),
      m5: defaultModule(),
      m_ic: defaultModule(),
    },
    loanOverrides: {},
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const saved = JSON.parse(raw);
    const def = defaultState();
    // Deep-merge modules so that new modules added after initial save are always present
    return {
      ...def,
      ...saved,
      modules: {
        ...def.modules,
        ...(saved.modules ?? {}),
      },
    };
  } catch {
    return defaultState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    console.warn('Could not save state to localStorage');
  }
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Save all student sessions to a separate key (for admin dashboard simulation). */
const SESSIONS_KEY = 'npl_model_sessions';

export interface StudentRecord {
  session: StudentSession;
  modules: AppState['modules'];
}

export function saveStudentRecord(state: AppState): void {
  if (!state.session) return;
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    const sessions: Record<string, StudentRecord> = raw ? JSON.parse(raw) : {};
    sessions[state.session.studentId] = {
      session: state.session,
      modules: state.modules,
    };
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    console.warn('Could not save student record');
  }
}

export function loadAllStudentRecords(): StudentRecord[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    return Object.values(JSON.parse(raw) as Record<string, StudentRecord>);
  } catch {
    return [];
  }
}
