import { useApp } from '../../context/AppContext';
import { FileText, TrendingUp, Building2, BookOpen, ChevronRight, CheckCircle2 } from 'lucide-react';
import { PageShell } from '../shared/PageShell';
import { TextAnswerInput } from '../shared/AnswerInput';
import { QuestionBlock } from '../shared/QuestionBlock';

function Section({ icon, title, children }: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 mb-5">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
        <div className="text-blue-600">{icon}</div>
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, sub, color = 'blue' }: {
  label: string; value: string; sub?: string; color?: 'blue' | 'green' | 'amber' | 'red';
}) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  };
  return (
    <div className={`border rounded-xl p-4 ${colors[color]}`}>
      <p className="text-xs opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

const moduleSteps = [
  {
    tab: 'Loan Tape',
    tag: 'Review',
    desc: 'Examine the raw bid tape  302 loans with face value, collateral, coupon, maturity, state, and LTV. Get familiar with the data before you model it.',
    color: 'bg-slate-50 border-slate-200',
    tagColor: 'bg-slate-200 text-slate-600',
  },
  {
    tab: 'Portfolio Composition',
    tag: 'Deliverable',
    desc: 'Segment the portfolio into A/B/C/D risk buckets by LTV. Analyse geographic concentration and judicial exposure. Answer: what exactly are you buying?',
    color: 'bg-blue-50 border-blue-100',
    tagColor: 'bg-blue-700 text-white',
  },
  {
    tab: 'Performing Baseline',
    tag: 'Deliverable',
    desc: 'Build the base-case cash flow model: all loans repay at par with quarterly interest, no defaults. Establish the upper-bound return at a given purchase price.',
    color: 'bg-indigo-50 border-indigo-100',
    tagColor: 'bg-blue-700 text-white',
  },
  {
    tab: 'Recovery Analysis',
    tag: 'Deliverable',
    desc: 'Introduce credit reality: The assumption here is that D-loans collect no interest; at maturity, recovery = min(balance, collateral). Model how losses and appreciation assumptions affect the bid price.',
    color: 'bg-orange-50 border-orange-100',
    tagColor: 'bg-blue-700 text-white',
  },
  {
    tab: 'Enforcement',
    tag: 'Deliverable',
    desc: 'Analyse the D-loan sub-portfolio in detail: split by judicial vs. non-judicial jurisdiction, calculate gross recovery proceeds, apply enforcement costs, and estimate net recovery — the foundation for D-resolution cash flows in Active Resolution.',
    color: 'bg-red-50 border-red-100',
    tagColor: 'bg-blue-700 text-white',
  },
  {
    tab: 'Active Resolution',
    tag: 'Deliverable',
    desc: 'Apply Heron\'s three resolution strategies: A-sale (sub-portfolio at effective yield), B-cure + re-performing sale, and C-DPO. D-enforcement is already modelled in the prior module. Measure the incremental value of active management.',
    color: 'bg-green-50 border-green-100',
    tagColor: 'bg-blue-700 text-white',
  },
  {
    tab: 'Loan-on-Loan Financing',
    tag: 'Deliverable',
    desc: 'Layer on a Loan-on-Loan (LoL) facility at 65% advance and 6.0% fixed from an Investment Bank. Quantify the leverage effect on equity IRR and compare levered vs. unlevered returns.',
    color: 'bg-amber-50 border-amber-100',
    tagColor: 'bg-blue-700 text-white',
  },
  {
    tab: 'Summary',
    tag: 'Review',
    desc: 'The return bridge: see the incremental IRR impact of each step — from Performing Baseline through to levered return. Identify where active management creates the most value.',
    color: 'bg-purple-50 border-purple-100',
    tagColor: 'bg-slate-200 text-slate-600',
  },
  {
    tab: 'IC Memo',
    tag: 'Deliverable',
    desc: 'Synthesise your analysis into a Round 1 IC recommendation: bid price, expected IRR, key risks, and investment rationale. A structured template is provided — complete this to consolidate your learning and demonstrate your investment thesis.',
    color: 'bg-rose-50 border-rose-200',
    tagColor: 'bg-blue-700 text-white',
  },
  {
    tab: 'Rescue Capital',
    tag: 'Under Development',
    desc: 'Explore management JV restructuring for selected C and D loans — where Heron partners with the borrower, writes down the debt, and takes control without enforcement. Profiles two loans from the bid tape.',
    color: 'bg-violet-50 border-violet-100',
    tagColor: 'bg-slate-200 text-slate-500',
  },
];

export function Module0View() {
  const { effectiveLoans, state, dispatch } = useApp();
  const isComplete = state.modules.m0?.completed ?? false;

  return (
    <PageShell narrow>

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">Deal Brief</p>
        <h2 className="text-3xl font-bold text-slate-900">Heron Capital — NPL Portfolio Acquisition</h2>
        <p className="text-slate-500 text-sm mt-2">
          US Commercial Real Estate Non-Performing Loan Portfolio — Q1 2026  {effectiveLoans.length} loans
        </p>
      </div>

      {/*  1. Market Context  */}
      <Section icon={<TrendingUp size={18} />} title="Market Context — Why NPLs Now?">
        <div className="space-y-4 text-sm text-slate-600">
          <p>
            From 2020-2022, historically low interest rates (Fed Funds 0-0.25%) drove aggressive CRE
            lending at compressed cap rates and elevated leverage. The Fed's 525bps hiking cycle
            (March 2022-July 2023) sharply increased debt service costs across the sector. By Q1 2026,
            the Fed Funds rate stands at ~4.25-4.50% and SOFR is ~4.3%.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                title: 'Refinancing cliff',
                body: 'An estimated $1.5-2.0 trillion of CRE loans originated 2019-2022 mature between 2024-2027. Many cannot refinance at current rates without significant equity injection or principal paydown.',
              },
              {
                title: 'Office sector impairment',
                body: 'Structural work-from-home shift has permanently impaired office values in major CBDs. Vacancy rates of 20-25%+ in New York, San Francisco, and Chicago are driving large NPL cohorts across lenders.',
              },
              {
                title: 'Regional bank supply',
                body: 'Smaller US banks — which hold ~70% of CRE debt — face increased regulatory capital requirements and are accelerating NPL dispositions to clean up balance sheets ahead of Basel III endgame rules.',
              },
              {
                title: 'CMBS distress',
                body: 'CMBS delinquency rates rose to ~68% by end-2025, with office and retail pools showing the highest stress. Special servicers are increasingly pursuing negotiated workouts and portfolio sales.',
              },
            ].map(item => (
              <div key={item.title} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="font-semibold text-slate-800 text-xs mb-1">{item.title}</p>
                <p className="text-xs text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 italic">
            Distressed debt buyers can acquire NPL portfolios comprised predominantly of office assets at
            discounts to par that more than compensate for credit losses and resolution costs — particularly
            when backed by tangible real estate collateral. The key edge is execution capability: speed to
            close, asset management expertise, and legal infrastructure across multiple jurisdictions.
          </p>
        </div>
      </Section>

      {/*  2. Heron Capital  */}
      <Section icon={<Building2 size={18} />} title="Heron Capital — The Firm">
        <div className="space-y-4 text-sm text-slate-600">
          <p>
            <strong className="text-slate-800">Heron Capital Partners</strong> is a New York-based alternative
            asset manager with approximately $18bn of assets under management. The firm operates across
            private equity, real estate, private credit, and special situations — with dedicated teams for
            each strategy. Within real estate, Heron manages vehicles targeting core-plus equity, preferred
            equity and stretch lending, CMBS and CRE CLOs, and distressed CRE debt and NPL acquisitions.
          </p>
          <p>
            <strong className="text-slate-800">Heron Capital Opportunistic Fund V</strong> is a $2bn
            closed-end fund raised in 2024, targeting distressed and special situations across CRE debt and
            equity with a 7-year fund life (2024-2031). The fund pursues multiple strategies — NPL portfolio
            acquisitions sit alongside CMBS purchases, rescue preferred equity injections, and DIP lending
            with allocation driven by risk-adjusted return at the time of deployment.
          </p>
          <p className="text-xs text-slate-500">
            For this NPL portfolio to clear Heron's Investment Committee, the bid price and resolution
            strategy must be structured to generate the following minimum return thresholds:
          </p>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Gross Unlevered IRR" value="12.5%+" sub="Minimum IC hurdle" color="blue" />
            <Stat label="Gross Levered IRR" value="15%+" sub="Target with LoL overlay" color="blue" />
            <Stat label="Gross MoIC" value="1.60+" sub="Minimum equity multiple" color="blue" />
          </div>
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
            <p className="font-semibold text-slate-800 mb-2">NPL Underwriting Framework</p>
            <p className="mb-2 text-slate-500">When evaluating NPL portfolio opportunities, Heron's underwriting focuses on four areas:</p>
            <ul className="list-disc ml-4 space-y-1.5">
              <li><strong className="text-slate-700">Collateral quality and enforceability</strong> — First-lien CRE loans only; collateral must be appraised independently. The LTV distribution drives loss estimates and recovery assumptions.</li>
              <li><strong className="text-slate-700">Geographic and jurisdictional exposure</strong> — State law governs enforcement rights. Judicial states (NY, PA) impose longer timelines; non-judicial states (CA, NH) allow faster foreclosure.</li>
              <li><strong className="text-slate-700">Resolution optionality</strong> — The ability to pursue multiple paths: sub-portfolio sales to performing lenders, cure and re-performance, negotiated DPOs, enforcement, or rescue capital injection (where Heron provides fresh equity or mezzanine to stabilise a borrower and protect collateral value). Optionality is a source of value not captured in passive hold models.</li>
              <li><strong className="text-slate-700">Financing overlay</strong> — Loan-on-Loan (LoL) facilities from investment banks can lever the equity return when the asset yield materially exceeds the cost of debt.</li>
            </ul>
          </div>
          <p>
            <strong className="text-slate-800">You are a member of Heron's acquisitions team.</strong> Metropolitan Bank has invited
            Heron to participate in a Round 1 bid process for a portfolio of {effectiveLoans.length} distressed CRE loans.
            The Round 1 submission must include an indicative bid price, a brief investment rationale, and
            confirmation of financing capacity. Your team has three weeks to complete underwriting on the basis
            of the bid tape alone - this model replicates that process.
          </p>
        </div>
      </Section>

      {/*  3. The Deal  */}
      <Section icon={<FileText size={18} />} title="The Deal — Metropolitan Bank NPL Portfolio">
        <div className="space-y-4 text-sm text-slate-600">

          {/* Seller & Motivation */}
          <div>
            <p className="font-semibold text-slate-800 text-xs uppercase tracking-wide mb-2">Seller &amp; Motivation</p>
            <p>
              <strong className="text-slate-800">Metropolitan Bank</strong> ("Metro") is a mid-size regional
              US commercial bank with approximately $28bn of assets. Metro originated the portfolio between
              2019 and 2022 during the low-rate environment, primarily to office and mixed-use CRE sponsors
              across California, New York, New Hampshire, and Pennsylvania. Following the 2022-2023 rate
              hiking cycle, a significant portion of the book has become sub-performing or non-performing as
              borrowers struggle to service debt at current rates or refinance at maturity.
            </p>
            <p className="mt-2">
              Metro is disposing of the portfolio to meet regulatory capital targets - specifically to reduce
              its Risk-Weighted Assets (RWAs) and improve its Common Equity Tier 1 (CET1) capital ratio ahead of a Q2 2026 supervisory
              review by the Office of the Comptroller of the Currency (OCC). A clean exit from the NPL book is preferable to a drawn-out workout
              programme given Metro's limited specialist resolution capacity.
            </p>
          </div>

          {/* Sale Process */}
          <div>
            <p className="font-semibold text-slate-800 text-xs uppercase tracking-wide mb-2">Sale Process</p>
            <p>
              The disposal is being run as a <strong className="text-slate-800">structured off-market process</strong> by
              Metro's financial adviser, targeting a small number of pre-qualified distressed debt investors.
              No public marketing — Metro requires confidentiality to avoid signalling credit stress to
              regulators and depositors.
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  step: 'Round 1 — Indicative Bid',
                  timing: 'Week 3 (end of Q1 2026)',
                  detail: 'Non-binding indicative bid submitted on the basis of the bid tape alone. Shortlisted bidders (expected: 2–3 investors) are invited to Round 2.',
                  color: 'bg-blue-50 border-blue-200 text-blue-900',
                },
                {
                  step: 'Round 2 — Full DD & Final Bid',
                  timing: 'Weeks 4–8',
                  detail: 'Successful Round 1 candidates receive access to the full document dataroom: individual loan files, borrower correspondence, legal title reports, independent appraisals, and property-level financials.',
                  color: 'bg-indigo-50 border-indigo-200 text-indigo-900',
                },
                {
                  step: 'Exclusivity & Close',
                  timing: 'Weeks 9–12',
                  detail: 'Preferred bidder granted exclusivity. SPA negotiated and signed. Completion targeted before Q2 2026 reporting date to allow Metro to derecognise the loans from its balance sheet.',
                  color: 'bg-green-50 border-green-200 text-green-900',
                },
              ].map(s => (
                <div key={s.step} className={`border rounded-xl p-3 ${s.color}`}>
                  <p className="font-semibold text-xs mb-0.5">{s.step}</p>
                  <p className="text-xs opacity-70 mb-1.5">{s.timing}</p>
                  <p className="text-xs leading-snug opacity-80">{s.detail}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <span className="font-semibold text-blue-700">Where we are:</span> Heron has received the bid
              tape and is currently in <strong>Round 1 — Indicative Bid</strong>. Your task is to underwrite
              the portfolio using only the information available at this stage and submit a non-binding bid
              price by the end of Week 3.
            </p>
          </div>

        </div>
      </Section>

      {/*  4. Assignment Overview  */}
      <Section icon={<BookOpen size={18} />} title="Assignment Overview — How to Use This Model">
        <div className="space-y-3 text-sm text-slate-600 mb-4">
          <p>
            This model replicates Heron's NPL underwriting process from raw loan tape to investment committee
            recommendation. Work through each tab in order — each module builds on the previous one.
          </p>
          <p>
            Each module tab contains a mix of <strong className="text-slate-800">quantitative questions</strong> and <strong className="text-slate-800">critical thinking questions</strong> graded by your instructor. Answer them directly in the model as you work through each tab.
            The <strong className="text-slate-800">IC Memo</strong> is a separate graded deliverable, to be completed once you have worked through all quantitative modules.
            In <strong className="text-slate-700">Recovery Analysis</strong>, credit reality is introduced: the assumption is that D-loans collect no interest;
            at maturity, recovery = min(balance, collateral). You will model how losses and appreciation assumptions affect the bid price.
          </p>
          <p>
            In practice, Heron's underwriting team would prepare a short Investment Committee Memo to support a Round 1 bid.
            A structured template is provided in the IC Memo tab — this is a graded deliverable and should be completed after working through the quantitative modules.
          </p>
        </div>

        <div className="space-y-2">
          {moduleSteps.map((step, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 border rounded-xl ${step.color}`}>
              <div className="flex items-center gap-2 shrink-0 mt-0.5">
                <span className="text-slate-400 text-xs font-bold w-4 text-right">{i + 1}</span>
                <ChevronRight size={12} className="text-slate-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-slate-800 text-sm">{step.tab}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${step.tagColor}`}>{step.tag}</span>
                </div>
                <p className="text-xs text-slate-600 leading-snug">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
          <p className="font-semibold mb-1">Modeling conventions</p>
          <ul className="space-y-1 list-disc ml-4">
            <li>Acquisition (closing) date: <strong>31 March 2026</strong> — First interest payment (IPD): <strong>30 June 2026</strong> (T+1 quarter)</li>
            <li>Interest is paid <strong>quarterly</strong> on the last day of March, June, September, December (quarter-end IPDs only)</li>
            <li>All loans are <strong>fixed rate, bullet repayment</strong> — no amortisation; full principal repaid at maturity on an IPD</li>
            <li>Resolution timings: A-sale T+1Q (Jun 2026); B re-performing sale T+3Q (Dec 2026); C-DPO T+12mo (Mar 2027); D non-judicial T+18mo (Sep 2027); D judicial T+36mo (Mar 2029)</li>
            <li>IRR is computed using XIRR (actual/365 day count) — consistent with Excel =XIRR()</li>
            <li>All key model inputs — purchase price, resolution assumptions, collateral appreciation rates, and financing terms — are controlled from the <strong>Assumptions</strong> tab in the top navigation bar. Changes there flow through every module automatically. Review this tab before working through the modules.</li>
          </ul>
        </div>
      </Section>

      <div className="mb-6">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Questions</h3>
        <p className="text-sm text-slate-500 mb-6">
          Answer using the Deal Brief content above. Focus on mechanism and implications.
        </p>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <QuestionBlock num="Q1" title="Why coupon alone is not enough">
            <TextAnswerInput
              questionId="db_q_discount_mechanism"
              module="m0"
              label="Using the Deal Brief page, explain why Heron cannot rely on coupon income alone to hit its 12.5% unlevered hurdle."
              rows={5}
            />
          </QuestionBlock>
          <QuestionBlock num="Q2" title="Round 1 constraints and bid confidence">
            <TextAnswerInput
              questionId="db_q_round1_limits"
              module="m0"
              label="What underwriting limitations exist in Round 1, and how should that change the confidence level of an indicative bid?"
              rows={5}
            />
          </QuestionBlock>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={() => dispatch({ type: 'MARK_COMPLETE', module: 'm0' })}
          disabled={isComplete}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors
            ${isComplete
              ? 'bg-green-100 text-green-700 cursor-default'
              : 'bg-blue-700 text-white hover:bg-blue-800'}`}
        >
          <CheckCircle2 size={15} />
          {isComplete ? 'Submitted' : 'Submit Answers'}
        </button>
      </div>

    </PageShell>
  );
}

