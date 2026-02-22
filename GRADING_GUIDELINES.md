# NPL Underwriting Model — AI Grading Design Guidelines

> **Purpose:** This document defines the standard for designing questions, model answers,
> rubrics, and grading prompts in the NPL Underwriting Model assignment. It should be
> consulted when writing new questions or updating existing ones.

---

## 1. Fundamental Constraint

**Only ask questions that AI can accurately grade.**

AI grading fails when:
- The correct answer depends on a number the student must read from the model (use AnswerInput + auto-check instead)
- The question is so open-ended that any coherent paragraph could score 3/3
- The model answer and rubric are inconsistent with each other
- Keywords in the rubric have no synonyms and students who know the concept will use different words

Before writing any text question, ask: *Can a well-calibrated LLM reliably distinguish a 1/3 from a 3/3 answer here?* If not, redesign.

---

## 2. Question Design

### 2.1 One concept per answer box

Each `TextAnswerInput` box must target **exactly one concept** — not a cluster of loosely related ideas.

The only permitted exception is a **profile question**: a question asking for multiple aspects of a single well-defined entity (e.g. "describe the borrower's financial position, motivation, and cooperation level"). This is acceptable because:
- All aspects describe the same object
- The rubric can assign one criterion per aspect
- Length constraints prevent rambling

Do NOT use profile-question boxes to combine multiple *concepts* (e.g. "explain borrower motivation AND judicial enforcement AND pricing" in one box — this is three questions, not one profile).

### 2.2 Question wording must demand causal reasoning

Never use wording that invites a list without mechanisms:
- ❌ "Name TWO factors that affect D-loan pricing."
- ✅ "Name TWO factors that affect D-loan pricing. For each, explain the mechanism by which it changes the bid price."

The distinction is critical: keywords without mechanisms score at most 2/3. The question must make clear that a mechanism is required.

**Format templates are mandatory for list-type answers.** When asking for N items, provide a fill-in template:
```
Factor 1: [name] — Mechanism: [how it works]
Factor 2: [name] — Mechanism: [how it works]
```
- Templates constrain length (preventing wall-of-text answers)
- They prevent students from writing N sentences that are really one concept rephrased
- They make rubric matching mechanical and reliable
- For fill-in templates, **state expected length per slot** (e.g. "1–2 sentences each" or "3 sentences max")

### 2.3 What NOT to ask

Avoid questions where:
- The answer is a number directly readable from the model output (use AnswerInput)
- The answer is a definition the student can copy from any textbook without understanding
- The question can be answered correctly with no reference to the specific portfolio
- There is only one possible correct answer phrased one way (brittle for AI grading)
- The answer is a ranking with no explanation required (combine ranking + explanation)

### 2.4 Pre-flight checklist before writing a question

1. Is the concept singular and well-bounded?
2. Does the wording explicitly demand causal reasoning (not just listing)?
3. If multi-part: is a format template provided with per-slot length guidance?
4. Is the model answer achievable in the stated length limit?
5. Can I write 3 distinct rubric criteria that map to the model answer?
6. Does every rubric criterion have ≥2 synonyms a student might use?

---

## 3. Rubric Design

### 3.1 Structure

Every rubric must:
- List 3–4 bullet points, each representing one gradeable concept
- Order from most to least critical (AI prioritises earlier criteria)
- Be phrased as **"Award marks for X"** or **"• X correctly identified"**

### 3.2 Keywords vs. causal reasoning

For each rubric criterion, distinguish:

- **Keywords** — terms the student must use (or a synonym of): e.g. "collateral cover / LTV / security value"
- **Causal reasoning flag** — the criterion requires the student to *explain why*, not just name it

Mark causal criteria explicitly: `(causal link required)` or `(mechanism expected)`. This tells the AI to penalise answers that name the concept but do not explain the mechanism.

### 3.3 Synonym lists

For any technically specific term, provide synonyms in parentheses. Example:
- "LTV covenant breach (also: LTV violation, ratio breach, covenant default)"
- "Discounted Payoff (also: DPO, negotiated settlement, principal haircut)"

This prevents the AI from penalising a student who knows the concept but uses slightly different terminology.

### 3.4 Scoring scale (0–3)

| Score | Criterion |
|-------|-----------|
| 0 | Missing, off-topic, or completely wrong |
| 1 | One key concept present, incomplete or imprecise. No causal reasoning. |
| 2 | Key concepts addressed, minor gaps. Causal reasoning present but incomplete. |
| 3 | All key concepts present with accurate causal reasoning throughout. |

The difference between 2 and 3 is almost always **causal reasoning**: a 2/3 answer reaches the right conclusion; a 3/3 answer explains *why* that conclusion follows.

### 3.5 Two-tier grading flags

Questions are tagged with one of two flags in the registry:

- **Standard** (default): AI grades and returns score. Instructor accepts AI output unless something looks wrong.
- **`instructorReview`**: AI grades but instructor spot-checks this question. Applied to synthesis or value-judgement questions where AI calibration is less reliable (e.g. `liquidityImplication` in M1b).
- **`instructorGraded`** (future): Instructor grades manually; AI does not attempt. Reserved for open-ended essays or questions requiring portfolio-specific calculation that the AI cannot verify.

---

## 4. Grading Prompt Design

### 4.1 Mandatory context preamble

Every grading prompt must include a context preamble explaining:
- Course name and level (Cornell REAL 6595 — graduate)
- Assignment topic (NPL portfolio, 302 loans, ~$1.9bn par, Metropolitan Bank seller; predominantly office assets)
- Heron Capital's role and 12.5% unlevered IRR hurdle rate
- Module scope: M1 = portfolio composition, M1b = stratification, M2 = performing baseline CF, M3 = recovery analysis (passive hold), M_ENF = enforcement scenario (D-loans only), M4 = active resolution (A-sale, B-cure, C-DPO — three strategies; D-enforcement handled in M_ENF), M5 = Loan-on-Loan financing, M_IC = IC Memo (graded deliverable); Rescue Capital = under development / out of scope for this assignment
- Key concepts the grader needs to know

Without this context, the AI may grade answers against general finance knowledge rather than the specific NPL course framework.

### 4.2 Per-question block structure

Each question block must include in order:
1. **Q:** the question label (exactly as shown to the student)
2. **MODEL ANSWER:** the full model answer text
3. **RUBRIC CRITERIA:** bullet points for the grader
4. **STUDENT ANSWER:** the student's verbatim response

The AI reads the model answer *before* the student answer. This anchors its expectations and prevents it from being anchored by the student's answer when scoring.

### 4.3 Auto-flag conditions

Include auto-flags in the prompt for:
- **Low word count**: answers under 20 words for a question requiring 2–3 sentences → flag as "answer may be incomplete"
- **Off-topic**: if the student answer contains no vocabulary from the question domain → flag as "possible misread"
- **Copy-paste**: if the student answer matches the model answer verbatim → flag as "possible plagiarism"

These flags do not change the score — they prompt the instructor to review.

---

## 5. What Not to Ask

These question types do NOT belong in the assignment:

| Question type | Reason |
|--------------|--------|
| "What is the WA LTV of the portfolio?" | Read directly from model output — use AnswerInput |
| "Define NPL" | Textbook definition, no understanding required |
| "List the four risk buckets" | No mechanism required, trivially googleable |
| "What are the pros and cons of X?" | Too open-ended, no rubric possible |
| Any question with a single-word answer | No causal reasoning possible |
| Questions that mix a numeric and a conceptual component in one box | Split into two boxes |

---

## 6. Calibration

Before deploying a new question to the full cohort:

1. Write the question, model answer, and rubric
2. Grade 5 student responses manually
3. Run the AI grader on the same 5
4. Compare AI score vs. manual score for each
5. Acceptable: AI within ±0.5 on average, no egregious outliers
6. If AI consistently over- or under-grades, revise the rubric (not the question)
7. Save calibration notes as a comment in the questions.ts entry

Target: AI calibration good enough that instructor review is needed only for borderline cases (score = 2 where 1 or 3 might be correct) and flagged synthesis questions.

---

## 7. Quick-Reference Checklist

### Writing a new question

- [ ] Single concept targeted (profile exception only for multi-aspect entity)
- [ ] Wording demands causal reasoning ("identify AND explain the mechanism")
- [ ] Format template provided if multi-part (with per-slot length)
- [ ] Length constraint stated (e.g. "2–3 sentences")
- [ ] Model answer fits within the length constraint
- [ ] 3–4 rubric criteria, ordered by importance
- [ ] Each criterion has synonyms for key terms
- [ ] Causal criteria flagged explicitly
- [ ] Registered in `questions.ts` with `rubric` field populated
- [ ] Added to `MODULE_QUESTION_ORDER` in correct position
- [ ] `TextAnswerInput` in the view has matching `questionId`, `label`, `modelAnswer`, `rows`

### Reviewing an existing question

- [ ] Does the current question still align with the grading guidelines?
- [ ] Is the model answer achievable in the `rows` height shown to students?
- [ ] Are rubric criteria still valid after any module restructuring?
- [ ] Is the question ID in `MODULE_QUESTION_ORDER` (not in the legacy section)?

---

## 8. Implementation Notes

### Files

| File | Purpose |
|------|---------|
| `src/lib/questions.ts` | Central registry — one entry per `questionId` |
| `src/lib/gradingPrompt.ts` | Builds formatted text prompt for Claude.ai |
| `src/pages/AdminPage.tsx` | "Grade with AI" button opens prompt modal |
| `src/components/shared/AnswerInput.tsx` | Student-facing input components |

### Workflow (Option A — copy-paste)

1. Open Admin dashboard at `/admin`
2. Select a student
3. Click **"Grade with AI"** button
4. Copy the generated prompt
5. Paste into [claude.ai](https://claude.ai) or another LLM
6. LLM returns scores + feedback for every text question
7. Instructor reviews, adjusts borderline scores, records final grades

### Extending to Option B (future)

When an Anthropic API key is added, `gradingPrompt.ts` can be extended to call the
API directly and return structured JSON scores. The prompt format is already designed
to produce parseable output. No change to question structure or rubrics is needed.

---

*Last updated: February 2026 — Cornell REAL 6595 NPL Underwriting Model*
