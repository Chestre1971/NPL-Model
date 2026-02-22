/**
 * IC Memo structured Investment Committee memorandum.
 * Students write the memo section by section with no prefilled model data on this page.
 */
import { useApp } from '../../context/AppContext';
import { TextAnswerInput, AnswerInput } from '../shared/AnswerInput';
import { CheckCircle2 } from 'lucide-react';
import { PageShell } from '../shared/PageShell';

function SectionHeader({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-sm font-bold text-blue-600 uppercase tracking-widest">{number}</span>
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
      </div>
      {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

function MemoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5 shadow-sm">
      {children}
    </div>
  );
}

export function ICMemoView() {
  const { m3PriceAt12pct, state, dispatch } = useApp();
  const isComplete = state.modules.m_ic?.completed ?? false;

  return (
    <PageShell narrow>

      {/* Header */}
      <div className="mb-8">
        <p className="text-sm font-semibold text-blue-600 uppercase tracking-widest mb-1">Investment Committee</p>
        <h2 className="text-2xl font-bold text-slate-900">Investment Memo - Heron NPL Portfolio</h2>
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          <strong>Instructions:</strong> This memo follows the structure of a real Investment Committee presentation.
          Complete each section using the analysis you built in earlier modules. No model data is prefilled on this page.
          A professional IC memo is precise, concise, and makes a clear recommendation supported by data.
        </div>
        <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <strong>Graded.</strong> This memo synthesises the full assignment. Complete every section using your own analysis from prior pages.
        </div>
      </div>

      {/*  1. Investment Thesis  */}
      <MemoCard>
        <SectionHeader
          number="01"
          title="Investment Thesis"
          subtitle="In 3-5 sentences: why is this portfolio an attractive investment for Heron Capital at this price and at this point in the cycle? Reference the macro context, collateral quality, and your expected return."
        />
        <TextAnswerInput
          questionId="ic_thesis"
          module="m_ic"
          label="Write your investment thesis"
          rows={5}
        />
      </MemoCard>

      {/*  2. Portfolio Analysis  */}
      <MemoCard>
        <SectionHeader
          number="02"
          title="Portfolio Analysis"
          subtitle="Describe the portfolio composition. What are the key risk characteristics? Which cohorts concern you most and why?"
        />

        <TextAnswerInput
          questionId="ic_portfolio_analysis"
          module="m_ic"
          label="Describe the portfolio - risk composition, geographic concentration, collateral quality, and key concerns"
          rows={5}
        />
      </MemoCard>

      {/*  3. Scenario Returns  */}
      <MemoCard>
        <SectionHeader
          number="03"
          title="Scenario Returns"
          subtitle="Write a brief commentary on the return progression and what it tells you about the value of active management."
        />

        <TextAnswerInput
          questionId="ic_scenario_commentary"
          module="m_ic"
          label="Comment on the return progression across scenarios. What does the gap between Performing Baseline and Active Resolution tell you about the value of active management?"
          rows={5}
        />
      </MemoCard>

      {/*  4. Financing Structure  */}
      <MemoCard>
        <SectionHeader
          number="04"
          title="Financing Structure"
          subtitle="Describe the proposed LoL financing. Is the structure appropriate given the portfolio characteristics? What are the key risks in the financing?"
        />
        <TextAnswerInput
          questionId="ic_financing"
          module="m_ic"
          label="Evaluate the LoL financing structure. Is the fixed rate appropriate? What are the covenant risks given the resolution timeline?"
          rows={5}
        />
      </MemoCard>

      {/*  5. Risk & Mitigants  */}
      <MemoCard>
        <SectionHeader
          number="05"
          title="Key Risks &amp; Mitigants"
          subtitle="Identify the top 3-4 risks to this investment thesis. For each risk, describe the mitigant and how it is reflected in the model."
        />
        <TextAnswerInput
          questionId="ic_risks"
          module="m_ic"
          label="Describe the top 3-4 risks and how each is mitigated in the investment structure or model"
          rows={8}
        />
      </MemoCard>

      {/*  6. Recommendation  */}
      <MemoCard>
        <SectionHeader
          number="06"
          title="Recommendation"
          subtitle="State your recommendation clearly. Provide the bid price, target IRR, and key conditions / assumptions that must hold for the investment to meet the IC hurdle."
        />

        {/* Bid price input */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          <AnswerInput
            questionId="ic_bid_price"
            module="m_ic"
            label="Recommended bid price ($m)"
            modelAnswer={m3PriceAt12pct}
            format="currency"
            tolerance={5}
            hint="Enter the price you recommend based on your own analysis from prior modules."
          />
          <AnswerInput
            questionId="ic_target_irr"
            module="m_ic"
            label="Target unlevered IRR (%)"
            modelAnswer={0.125}
            format="pct"
            tolerance={0.005}
            hint="Heron's IC hurdle is 12.5% unlevered"
          />
        </div>

        <TextAnswerInput
          questionId="ic_recommendation"
          module="m_ic"
          label="State your recommendation - Buy or Pass? Provide your recommended bid price, rationale, and the 2-3 conditions that must hold for the investment to succeed."
          rows={6}
        />

        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <strong>IC hurdles (Heron mandate):</strong> Gross unlevered IRR ≥ 12.5% · Gross levered IRR ≥ 15% · MoIC ≥ 1.60.
        </div>
      </MemoCard>

      {/* Submit */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={() => dispatch({ type: 'MARK_COMPLETE', module: 'm_ic' })}
          disabled={isComplete}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors
            ${isComplete
              ? 'bg-green-100 text-green-700 cursor-default'
              : 'bg-blue-700 text-white hover:bg-blue-800'}`}
        >
          <CheckCircle2 size={15} />
          {isComplete ? 'Submitted' : 'Submit IC Memo'}
        </button>
      </div>

    </PageShell>
  );
}
