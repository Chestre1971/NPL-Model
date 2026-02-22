# Pedagogical Review — NPL Underwriting Model
## Cornell REAL 6595 · Heron Capital Case Study

Reviewed: February 2026 · npl-model-v2

---

## 1. Executive Summary

The assessment is well-designed at a macro level: the module sequence scaffolds appropriately from data literacy (M1b) through technical modelling (M2–M3), strategic decision-making (M4), and financial structuring (M5) to synthesis (IC Memo). Rubrics are notably strong — they consistently reward causal reasoning over keyword coverage, and the explicit 0–3 scoring scale with "SCORING: 3/2/1/0" guidance in the best rubrics sets a high standard.

**Key strengths:**
- Scaffolded narrative arc — each module depends conceptually on the prior one
- Rubrics penalise vague answers; they require mechanism not just conclusion
- Structured-format questions (templates with blanks) consistently elicit better, more comparable answers than open-ended prompts
- Market context questions (M4/M5) reward students engaging with current conditions
- Negative leverage inflection point question (M5) is analytically demanding and distinctive

**Key concerns to address:**
1. **M1b Q1/Q2 overlap** — `coverMechanics` and `ltvThreshold` elicit nearly identical insight; students will repeat themselves
2. **M2 numeric dependency on Excel workflow** — all three numeric questions require CSV export + XIRR, creating operational risk that has nothing to do with understanding
3. **Missing M2→M3 bridge question** — no question explicitly asks students to interpret the gap between performing baseline price and recovery price at 12% IRR
4. **M4 is the longest module** — 8 active questions covering 4 distinct strategies; assess whether this is completable in a single sitting
5. **M5 positive/negative leverage overlap** — `m5_mkt_positive_leverage` substantially duplicates `m5_negative_leverage`

---

## 2. Learning Objectives and Scaffolding

### Bloom's Taxonomy distribution

| Module | Dominant level | Description |
|---|---|---|
| M1b | Analysis | Interpret stratification data; identify patterns |
| M2 | Application + Analysis | Run model; understand what results mean |
| M3 | Analysis + Evaluation | Interpret losses; evaluate sensitivity |
| M4 | Evaluation + Synthesis | Compare strategies; assess market context |
| M5 | Evaluation | Assess leverage effects; evaluate risk |
| IC Memo | Synthesis | Integrate across all prior modules |

The distribution is appropriate. The progression from lower to higher cognitive demand is well-executed. One gap: **no questions are explicitly at the Application level requiring students to derive a decision from the model output** ("given this IRR, should Heron bid? Under what conditions?"). Students record results and explain concepts but are rarely asked to make and defend an investment decision based on those results — which is the IC Memo's job, but it arrives after students have already worked through all the modelling.

**Recommendation:** Add one decision-point question at the end of M3: *"Given the Recovery Analysis IRR and the 12% hurdle, what does this result alone tell you about the entry price? Would you proceed with the bid at this price? Why or why not?"* This bridges analysis to evaluation before students reach the active resolution strategies.

### Module sequencing

The M2 → M3 → M4 linkage through `SharedAssumptions` (purchase price flows through all modules) is pedagogically strong — students experience concretely that changing one assumption ripples across the entire model. However, this dependency is not explicitly surfaced in any question. A student who doesn't notice that M3 uses their M2 purchase price may miss the chain of causality that the model is designed to teach.

**Recommendation:** Add one sentence to the M3 module preamble: *"Note: this module uses the purchase price you derived in Performing Baseline. Changing that price here will update your Recovery Analysis results."*

---

## 3. Module-by-Module Analysis

### Module 1b — Portfolio Composition (7 questions, all text)

**Strengths:**
- Entirely text-based — good: data reading and interpretation require explanation, not number entry
- Synthesis question (`synthesisBid`) is effective: the structured template ("Characteristic ___ → bid [higher/lower] because...") elicits structured, comparable responses
- `crossTabInterpretation` requires multi-dimensional reasoning (risk × jurisdiction combined) — the most analytically demanding question in M1b
- `cashDivergence` is practical and counterintuitive for students who conflate contractual maturity with cash receipt

**Concerns:**

**Q1/Q2 overlap (coverMechanics / ltvThreshold):** Q1 asks students to explain what the cover ratio tells you about credit loss severity, which necessarily involves the 100% LTV threshold. Q2 then asks about the 100% LTV tipping point directly. A thorough answer to Q1 already contains Q2. Students will either repeat themselves or omit depth from Q1 to save it for Q2.

*Recommendation:* Merge Q1 and Q2 into a single question, or reframe Q2 to extend Q1 rather than rephrase it. For example, Q2 could ask: *"At exactly 100% LTV, is Heron's expected loss zero or positive? Compute the expected recovery for a D-loan with a $10m balance and $7.1m collateral value."* This forces quantification rather than explanation and differentiates it clearly from Q1.

**Q3 and M1 questions:** `borrower_CD` in M1b covers essentially the same territory as `motivCD` in M1 (C/D borrower profiles). If students complete M1 before M1b, the M1b question will feel like repetition. If M1 is no longer in the active route, this is fine — but confirm that M1 questions (`motivAB`, `motivCD`, `synthesize`) are not being asked alongside M1b questions in any session flow.

**Q5 format:** `judicialDImpact` includes the enforcement timing data directly in the label (18–36 months vs. 6–18 months). This makes the question easier but reduces the amount of domain knowledge being tested. Consider whether the timing data should be provided (scaffolding) or expected from recall (higher cognitive demand). Both are defensible pedagogically.

**Overall M1b rating: Strong.** Seven well-sequenced text questions with good rubrics. Merge Q1/Q2 and the module is excellent.

---

### Module 2 — Performing Baseline (3 numeric + 2 text)

**Strengths:**
- `m2_q3_upper_bound` is conceptually central to the entire assignment — the idea that performing baseline is a ceiling anchors all subsequent modelling. The question is well-phrased.
- `m2_q4_yield_vs_hurdle` — the insight that the discount IS the return mechanism (not a margin of safety) is a sophisticated concept well-tested here

**Concerns:**

**Numeric questions all require CSV export + Excel XIRR.** Students must: (1) click Export, (2) open a file, (3) paste correctly into Excel, (4) apply XIRR correctly with date column. This is a 3-step operational process where any step can fail for reasons unrelated to financial understanding. Students who encounter export issues, date-format mismatches, or XIRR syntax errors will be penalised on auto-graded numeric questions despite potentially understanding the concept correctly.

*Recommendation:* Add the IRR and MoIC results in a clearly labelled display within the model itself (as an "answer check" stat card), so students can confirm their Excel computation independently. Alternatively, accept a wider tolerance (±0.5% rather than ±0.1%) for XIRR-derived numeric answers. The current auto-grading uses tight tolerances appropriate for model-read values but potentially too tight for Excel derivations.

**No "so what" question.** After three numeric questions (IRR at par, MoIC at par, price at 12% IRR), students know the numbers but are not asked whether the result means Heron should bid. Adding: *"The performing baseline price to achieve 12% IRR is $Xm. Is this a reasonable bid? What does it not account for?"* would bridge to M3 naturally.

**Question label naming inconsistency.** `m2_q2_irr_par` is Q1, `m2_q_moic` is Q2, `m2_q2_irr_target` is Q3 — the IDs are slightly inconsistent in naming (q2 appears twice). This is an internal ID issue that doesn't affect students but can create AdminPage display confusion.

**Overall M2 rating: Functional, with risk.** The conceptual text questions are strong; the numeric workflow creates operational fragility.

---

### Module 3 — Recovery Analysis (2 numeric + 3 text)

**Strengths:**
- Best question set in the app. All three text questions are genuinely demanding:
  - `recovery_q5_appreciation` requires sensitivity analysis + causal interpretation (counter-cyclical thesis)
  - `recovery_q_floor` requires understanding the model's own assumptions as distinct from reality
  - `recovery_q_lossdriver` requires decomposing loss into its components (LTV depth × loan size × collateral quality)
- The "floor vs. reality" framing is pedagogically precise and prevents a common student misconception (confusing model floor with guaranteed outcome)

**Concerns:**

**Missing M2→M3 bridge.** The performing baseline establishes an upper bound; the recovery analysis establishes a floor. The gap between them represents the credit loss discount — arguably the most important number in the entire assignment. No question explicitly asks students to compute or interpret this gap. `recovery_q4_price_gap` exists in the registry but may not be an active question in MODULE_QUESTION_ORDER.

*Recommendation:* Restore `recovery_q4_price_gap` as an active numeric question, or add a text question: *"The performing baseline price at 12% IRR is $Xm and the recovery price at 12% IRR is $Ym. What does the difference ($Zm) represent economically? What is Heron willing to pay for active management capability?"* This is the conceptual cornerstone of the entire assignment.

**Two numerics only.** With 2 active numeric questions (recovery_q1_irr and recovery_q3_losses), M3 is relatively light on model interaction compared to M4. Students might answer the text questions well without deeply engaging with the model's output. Adding the price-gap numeric reinforces model interaction.

**`recovery_q_lossdriver` model answer detail:** The three factors (LTV depth, loan size, collateral quality) are excellent, but the model answer cites the loss formula (`loss = balance − min(balance, collateral)`) without providing an example calculation. A worked example (e.g., "$10m balance / $7.1m collateral → $2.9m loss") would help instructors assess whether student answers demonstrate quantitative understanding vs. qualitative paraphrasing.

**Overall M3 rating: Excellent conceptually.** Restore the M2→M3 gap question and this is the strongest module.

---

### Module 4 — Active Resolution (8 questions: mixed)

**Strengths:**
- `m4_a_tradeoff` — IRR vs. MoIC trade-off with quantification requirement is excellent; the "hurdle-rate environment that favours sell" dimension rewards students who think beyond the single model scenario
- `m4_b_strategy` — "Why wait two quarters?" is the right question to ask; tests understanding of re-performing loan pricing dynamics
- `m4_c_dpo_rationale` — differential discount rates for interest vs. principal is the most technically demanding conceptual question in M4; tests credit hierarchy understanding
- `m4_d_judicial_impact` — PV cost quantification requirement is appropriate and distinctive
- `m4_mkt_timing` — Q1 2026 vs. 2022 comparison rewards current market awareness; appropriate for a graduate course

**Concerns:**

**Module length.** Eight questions covering four sub-strategies plus market context. If each text question requires 150–250 words, the written workload for M4 alone is 1,000–2,000 words — more than most modules combined. This may cause students to skim answers or rush the final questions (m4_mkt_execution, m4_mkt_timing) after investing effort in the earlier strategy questions.

*Recommendation:* Confirm the actual active question list. If MODULE_QUESTION_ORDER is exactly 8 questions, consider whether `m4_d_force_cost_sensitivity` is necessary alongside `m4_d_judicial_impact` — both explore D-loan cost sensitivity. The judicial impact question is more distinctive; the force cost sensitivity question is more of a "move a slider" exercise.

**ID mismatch.** MODULE_QUESTION_ORDER uses `m4_a_tradeoff_explain` and `m4_servicer_fee_underestimate` but the registry has `m4_a_tradeoff` and `m4_servicer_fee_impact`. If these IDs don't match, the AdminPage rubric display will show "unknown question" for those items and the grading prompt will lack model answers.

*Action:* Verify that all IDs in MODULE_QUESTION_ORDER exactly match QUESTION_REGISTRY keys.

**A-sale numerics.** `m4_a_port_c_price`, `m4_b_cure`, `m4_b_sale`, `m4_c_dpo_total`, `m4_d_nj_recovery`, `m4_d_j_recovery` exist in the registry — if any of these are in MODULE_QUESTION_ORDER, the module is significantly longer than 8 questions. Check the actual MODULE_QUESTION_ORDER to confirm which numerics are active.

**Overall M4 rating: Strong conceptually, potentially too long.** Verify question-order length and fix any ID mismatches.

---

### Module 5 — Loan-on-Loan Financing (4 numeric + 4 text)

**Strengths:**
- `m5_negative_leverage` — the best single question in the entire app. Requires: (1) identifying the 6.5% inflection, (2) showing the algebraic logic, (3) deriving four risk management implications. A comprehensive answer demonstrates genuine understanding of leverage mechanics, not just vocabulary.
- Numeric questions (levered IRR, levered MoIC, LoL amount, equity invested) are all model-read rather than Excel-derived — this avoids the operational risk present in M2.

**Concerns:**

**`m5_mkt_positive_leverage` / `m5_negative_leverage` overlap.** Both questions ask about the conditions for positive leverage and what happens if the unlevered IRR falls below the debt cost. A strong answer to `m5_negative_leverage` already addresses the entire content of `m5_mkt_positive_leverage`. Students will either repeat themselves or leave one question thin.

*Recommendation:* Replace `m5_mkt_positive_leverage` with a question on **release pricing mechanics**: *"The LoL facility requires 70% of every asset sale proceed to repay the facility. Explain how this creates a liquidity constraint for Heron. What happens if Heron resolves A-loans (large, early cash flows) before D-loans — how does release pricing affect the equity cash flow profile?"* This tests a distinct and underexplored concept.

**LoL rate market question.** `m5_mkt_lol_rate` (is 6.5% fair?) is good but requires students to know the SOFR spread context. The model answer provides the benchmark (SOFR + 220bps) — if students don't know current SOFR, they cannot answer this independently. Consider whether providing the current SOFR rate in the module preamble is appropriate (scaffolding) or whether the research requirement is intentional (graduate-level expectation).

**Overall M5 rating: Strong.** Fix the positive/negative leverage duplication and this is a well-designed module.

---

## 4. Rubric and Grading Design

### What works well

**Causal reasoning standard is consistently applied.** The best rubrics (M1b `coverMechanics`, M4 `m4_c_dpo_rationale`) explicitly state: "must explain WHY" and "mechanism expected, not just label." This is the right standard for graduate-level assessment and the rubrics enforce it correctly.

**Explicit scoring criteria.** The `coverMechanics` rubric is the model to replicate across all questions:
```
SCORING: 3 = all four points with causal reasoning throughout;
         2 = three points or causal mechanism missing on one dimension;
         1 = correct concept but only surface description;
         0 = missing or off-topic.
```
Most rubrics use "Award marks for:" without this explicit calibration. Standardising all rubrics to the SCORING: 3/2/1/0 format would significantly reduce instructor variability in applying the scale.

**Model answers are comprehensive.** Every text question has a 150–400 word model answer that goes beyond a "correct answer" to demonstrate the full reasoning chain. This is excellent for calibrating instructors and for the AI grading prompt.

### Rubric inconsistencies to address

1. **Variable specificity.** Some rubrics list 4–5 specific bullet criteria with explicit point allocation; others list 2–3 general criteria with "Award marks for:" without distinguishing what earns a 1 vs. 2 vs. 3.

2. **"Accept reasonable alternatives" vs. specific answers.** `dataGaps` has "Accept any two well-reasoned unknowns" — good flexibility. Other rubrics are much more prescriptive. Consider whether each rubric is appropriately open vs. prescriptive for the specific question type.

3. **Numeric tolerance.** The auto-grader uses a fixed tolerance, but M2 numeric answers are derived from Excel (XIRR) while M3/M4/M5 numerics are model-read. These have different precision expectations. Consider different tolerances by question type.

---

## 5. Cross-Cutting Observations

### What the assignment does well

**Vertical integration.** The purchase price linkage M2 → M3 → M4 via SharedAssumptions is the best feature of the assessment. Students cannot answer M4 questions without having engaged with M2 and M3.

**Counter-intuitive concepts targeted.** Several questions target common misconceptions directly:
- "The discount IS the return mechanism, not a bargain" (M2)
- "The performing baseline is an upper bound, not a base case" (M2)
- "Recovery Analysis is a floor under model assumptions but not a guarantee" (M3)
- "At exactly 6.5% unlevered IRR, leverage adds nothing" (M5)

**Market context integration.** M4/M5 market questions reward students who follow CRE and credit markets. This is appropriate differentiation for a graduate course.

### Gaps

**No inter-module synthesis questions (before IC Memo).** Every question is contained within its module. There is no question that explicitly asks students to cite a result from a prior module. For example: *"Your M2 performing baseline price was $Xm and your M3 recovery price at 12% was $Ym. Your M4 active resolution price is $Zm. Which management activity — going from floor to active resolution — created the most incremental value per dollar?"* This type of question would reinforce the vertical integration the model embeds.

**No "fail" scenario questions.** Every question assumes Heron is proceeding toward a bid. No question asks: *"Under what conditions should Heron NOT bid for this portfolio?"* or *"What portfolio characteristic, if discovered in due diligence, would cause you to withdraw?"* This executive decision-making dimension is central to real IC Memo practice.

**Assumption sensitivity is underexplored across modules.** The `recovery_q5_appreciation` question (set collateral appreciation to +3% and observe) is an excellent sensitivity exercise. There is no equivalent in M2 (e.g., what if coupon payments are 20% lower due to partial non-payment across A/B loans?) or M5 (what if the LoL advance rate is reduced to 55%?).

---

## 6. Priority Recommendations

Listed by implementation effort (ascending) and pedagogical impact (descending).

### High impact, low effort

1. **Standardise all rubrics to "SCORING: 3/2/1/0" format.** Copy the `coverMechanics` rubric structure across all text questions. The content of existing rubrics is good; it just needs consistent calibration language.

2. **Verify M4 ID alignment.** Confirm that `m4_a_tradeoff_explain` and `m4_servicer_fee_underestimate` in MODULE_QUESTION_ORDER exactly match their QUESTION_REGISTRY keys. Mismatched IDs silently break the AdminPage rubric display.

3. **Add M3 bridge question.** Restore `recovery_q4_price_gap` as a live question (or add a text equivalent), asking students to interpret the M2→M3 gap explicitly.

4. **Add M3 decision question.** After recovering the Recovery IRR, ask: *"Given this result and Heron's 12% hurdle, does Recovery Analysis alone justify a bid? What does it not tell you?"*

### Medium impact, medium effort

5. **Merge M1b Q1/Q2.** Combine `coverMechanics` and `ltvThreshold` into one question with a forced quantification component. This reduces redundancy and adds differentiation.

6. **Replace M5 `m5_mkt_positive_leverage` with a release pricing question.** The 70% release rate is underexplored and creates genuine complexity worth assessing.

7. **Add M2 numeric tolerance note.** Either widen the XIRR tolerance or display the confirmed model answer in a reference stat card, reducing the operational penalty for Excel workflow issues.

### Lower priority, longer term

8. **Add one inter-module synthesis question.** Before the IC Memo, add a question requiring students to cite results from at least two prior modules explicitly. This rewards students who track their model outputs across tabs.

9. **Add a "walk away" question.** Ask: *"Name two specific due diligence findings that would cause Heron to lower the bid substantially or withdraw from the process entirely."* This elevates the assessment from model-operation to investment judgment.

10. **IC Memo review.** A complete pedagogical review of the IC Memo module was not performed; the questions.ts section for `m_ic` was not available for review. A separate review of the IC Memo question set is recommended to ensure it appropriately synthesises across all prior modules and does not simply repeat M4/M5 questions.

---

## 7. Summary Scorecard

| Module | Question count | Balance | Rubric quality | Scaffolding | Rating |
|---|---|---|---|---|---|
| M1b | 7 text | Good | Good–Strong | Strong | **B+** |
| M2 | 3 numeric + 2 text | OK | Good | Good | **B** |
| M3 | 2 numeric + 3 text | Good | Strong | Strong | **A−** |
| M4 | 8 mixed | Heavy | Good | Strong | **B+** |
| M5 | 4 numeric + 4 text | Good | Good | Good | **B+** |
| IC Memo | Not reviewed | — | — | — | — |

**Overall: B+.** The assessment framework is well-constructed. The primary improvements needed are mechanical (ID alignment, numeric tolerance, rubric consistency) and conceptual (bridge questions, decision-point questions). The core architecture — scaffolded modules, causal reasoning rubrics, vertical integration through shared assumptions — is sound and should be preserved.
