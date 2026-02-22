import { ArrowRight, Building2, Users, CircleDollarSign, Handshake } from 'lucide-react';
import { PageShell } from '../shared/PageShell';

//  Two illustrative loans pulled directly from the tape 

const CASE_C = {
  loanId: 'C7973233',
  borrower: 'Ascendant Alpha LP',
  jurisdiction: 'California',
  judicial: false,
  balance: 3_429_624,
  collateral: 3_626_366,
  ltv: 0.9457,
  coupon: 0.0286,
  maturity: 'Jan 2028',
  assets: 5,
  // Proposed restructuring (placeholder assumptions)
  restructuredBalance: 3_000_000,
  borrowerEquityContribution: 300_000,
  heronJVStake: 0.70,
  borrowerJVStake: 0.30,
  managementFee: '1.5% of GAV p.a.',
  notes:
    'Borrower retains 5-asset California portfolio operations under a management JV. ' +
    'Fresh equity injection reduces debt to collateral parity; Heron holds controlling ' +
    'JV interest and receives preferred return. Non-judicial jurisdiction enables faster ' +
    'implementation without court proceedings.',
};

const CASE_D = {
  loanId: 'D6580508',
  borrower: 'Lucas Martin',
  jurisdiction: 'New York',
  judicial: true,
  balance: 9_437_034,
  collateral: 6_019_491,
  ltv: 1.5677,
  coupon: 0.0730,
  maturity: 'Jan 2028',
  assets: 5,
  projectedLoss: 3_417_543,
  enforcementTimeline: '36 months (judicial)',
  // Proposed restructuring (placeholder assumptions)
  restructuredBalance: 5_500_000,
  borrowerEquityContribution: 500_000,
  heronJVStake: 0.80,
  borrowerJVStake: 0.20,
  managementFee: '1.5% of GAV p.a.',
  notes:
    'Deeply underwater D-loan in judicial New York. Enforcement would take 36 months ' +
    'and recover only ~$5.7m. Restructuring writes debt to ~$5.5m, eliminates the ' +
    'enforcement timeline, and aligns borrower incentives through a 20% promote. ' +
    'Heron controls the asset and receives full preferred return on restructured balance.',
};

function fmt$ (n: number) {
  return '$' + (n / 1_000_000).toFixed(2) + 'm';
}
function fmtPct(n: number) {
  return (n * 100).toFixed(1) + '%';
}

function Tag({ label, color }: { label: string; color: string }) {
  return (
    <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${color}`}>{label}</span>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-1.5 border-b border-slate-100 last:border-0 ${highlight ? 'text-blue-900 font-semibold' : ''}`}>
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

function CaseStudyCard({
  loan,
  riskColor,
}: {
  loan: typeof CASE_C | typeof CASE_D;
  riskColor: string;
}) {
  const writeDown = loan.balance - loan.restructuredBalance;
  const writeDownPct = writeDown / loan.balance;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className={`px-5 py-4 border-b border-slate-100 ${riskColor}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Tag
                label={`Risk ${loan.loanId.charAt(0)}`}
                color={loan.loanId.startsWith('C') ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}
              />
              {loan.judicial && <Tag label="Judicial" color="bg-slate-200 text-slate-600" />}
              {!loan.judicial && <Tag label="Non-Judicial" color="bg-green-100 text-green-700" />}
            </div>
            <p className="font-bold text-slate-900 text-base">{loan.borrower}</p>
            <p className="text-sm text-slate-500">{loan.loanId} · {loan.jurisdiction} · {loan.assets} assets · matures {loan.maturity}</p>
          </div>
          <Building2 size={22} className="text-slate-300 shrink-0 mt-1" />
        </div>
      </div>

      {/* Current position vs. restructured */}
      <div className="grid grid-cols-2 divide-x divide-slate-100">

        {/* Current terms */}
        <div className="p-4">
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">Current Position</p>
          <Row label="Loan Balance" value={fmt$(loan.balance)} />
          <Row label="Collateral Value" value={fmt$(loan.collateral)} />
          <Row label="LTV" value={fmtPct(loan.ltv)} highlight />
          <Row label="Coupon" value={fmtPct(loan.coupon)} />
          {'projectedLoss' in loan && loan.projectedLoss > 0 && (
            <Row label="Projected Loss (recovery)" value={`(${fmt$(loan.projectedLoss)})`} highlight />
          )}
          {'enforcementTimeline' in loan && (
            <Row label="Enforcement Timeline" value={loan.enforcementTimeline as string} />
          )}
        </div>

        {/* Proposed restructuring */}
        <div className="p-4 bg-blue-50/40">
          <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-2">Proposed Restructuring</p>
          <Row label="Restructured Balance" value={fmt$(loan.restructuredBalance)} highlight />
          <Row label="Debt Write-Down" value={`${fmt$(writeDown)} (${fmtPct(writeDownPct)})`} />
          <Row label="Borrower Equity In" value={fmt$(loan.borrowerEquityContribution)} />
          <Row label="Heron JV Stake" value={fmtPct(loan.heronJVStake)} highlight />
          <Row label="Borrower JV Stake" value={fmtPct(loan.borrowerJVStake)} />
          <Row label="Mgmt Fee (borrower)" value={loan.managementFee} />
        </div>
      </div>

      {/* JV Structure diagram (simplified) */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-center gap-2 mt-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-600">
          <div className="text-center">
            <p className="font-bold text-blue-800">Heron Fund</p>
            <p className="text-slate-500">{fmtPct(loan.heronJVStake)} control — preferred return</p>
          </div>
          <div className="flex items-center gap-1 text-slate-300">
            <ArrowRight size={14} />
            <Users size={14} className="text-slate-400" />
            <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} />
          </div>
          <div className="text-center">
            <p className="font-bold text-slate-700">{loan.borrower.split(' ')[0]}</p>
            <p className="text-slate-500">{fmtPct(loan.borrowerJVStake)} promote — day-to-day ops</p>
          </div>
        </div>

        <p className="text-sm text-slate-500 mt-3 leading-relaxed">{loan.notes}</p>
      </div>
    </div>
  );
}

export function RescueCapitalView() {
  return (
    <PageShell>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-900">Rescue Capital</h2>
          <span className="text-sm font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-500 uppercase tracking-wide">Under Development</span>
        </div>
        <p className="text-slate-500 text-sm mt-1">Management JV Restructuring — C &amp; D Loan Case Studies</p>
      </div>

      {/* Coming soon banner */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
        <p className="font-semibold mb-1">Placeholder — Module Under Development</p>
        <p className="text-sm leading-relaxed">
          This module will be fully built out in a future version. The two case studies below illustrate
          the concept using real loans from the bid tape. The analysis questions, model inputs, and IRR
          comparison outputs will be added once the restructuring framework is finalised.
        </p>
      </div>

      {/* Concept explanation */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
          <Handshake size={18} className="text-blue-600" />
          <h3 className="text-base font-bold text-slate-900">What is a Rescue Capital / Management JV?</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-slate-600">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <CircleDollarSign size={15} className="text-blue-500" />
              <p className="font-semibold text-slate-800 text-sm">The Problem</p>
            </div>
              <p className="text-sm leading-relaxed">
              C and D borrowers face loans they cannot refinance at current rates. Enforcement is costly
              and slow — especially in judicial states. The NPL buyer holds a distressed asset with limited
              near-term exit options.
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Users size={15} className="text-blue-500" />
              <p className="font-semibold text-slate-800 text-sm">The Structure</p>
            </div>
              <p className="text-sm leading-relaxed">
              The NPL fund writes down the debt to a sustainable level. The borrower injects a small amount
              of fresh equity and receives a management JV contract — continuing to operate the asset for a
              fee and a minority promote. Control reverts to the fund.
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Building2 size={15} className="text-blue-500" />
              <p className="font-semibold text-slate-800 text-sm">The Benefit</p>
            </div>
              <p className="text-sm leading-relaxed">
              Avoids enforcement cost and delay. Borrower retains operational continuity and an equity
              stake — incentivising performance. Fund gains control without going through courts, and
              positions the asset for an exit at stabilised value.
            </p>
          </div>
        </div>
      </div>

      {/* Case studies */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          Illustrative Case Studies — Selected from Bid Tape
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <CaseStudyCard loan={CASE_C} riskColor="bg-orange-50" />
          <CaseStudyCard loan={CASE_D} riskColor="bg-red-50" />
        </div>
      </div>

      {/* Placeholder analysis section */}
      <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Analysis — Coming Soon</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            'Restructured IRR vs. enforcement IRR comparison',
            'Sensitivity: borrower equity contribution vs. Heron JV stake',
            'Timeline analysis: JV close vs. judicial enforcement',
            'Exit strategy: stabilised asset sale vs. refinance',
            'Critical thinking questions on rescue capital economics',
          ].map(item => (
            <div key={item} className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-300 text-sm mt-0.5"></span>
              <p className="text-sm text-slate-400 italic">{item}</p>
            </div>
          ))}
        </div>
      </div>

    </PageShell>
  );
}


