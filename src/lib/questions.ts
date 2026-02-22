/**
 * Central question registry used by AdminPage for instructor grading.
 */
export interface QuestionDef {
  id: string;
  module: string;
  label: string;
  type: 'numeric' | 'text';
  modelAnswer: string;
  rubric?: string;
}

export const QUESTION_REGISTRY: Record<string, QuestionDef> = {
  // Deal Brief (m0)
  db_q_discount_mechanism: {
    id: 'db_q_discount_mechanism', module: 'm0', type: 'text',
    label: 'Why Heron cannot rely on coupon income alone to hit 12.5% IRR',
    modelAnswer: 'Coupon is legacy performing-loan pricing. Heron needs extra return for distress risk, illiquidity, and complexity, so excess return must come from entry discount plus execution.',
    rubric: 'Award marks for: hurdle vs coupon gap; discount-to-par as return mechanism; distress complexity/illiquidity premium.',
  },
  db_q_round1_limits: {
    id: 'db_q_round1_limits', module: 'm0', type: 'text',
    label: 'Round 1 underwriting limits and confidence in indicative bid',
    modelAnswer: 'Round 1 is tape-only with missing legal/collateral detail. Confidence is lower and bid should reflect uncertainty with conservative assumptions/margin of safety.',
    rubric: 'Award marks for: identifying tape-only limitations; valuation risk from missing diligence; implication for bid conservatism.',
  },

  // Loan Tape + Summary (m1)
  lt_q_avg_tail: {
    id: 'lt_q_avg_tail', module: 'm1', type: 'text',
    label: 'Why average LTV is not enough for tape-level underwriting',
    modelAnswer: 'Average LTV hides dispersion. Tail loans drive losses while low-LTV loans stay money-good, so pricing must use distribution and concentration, not mean only.',
    rubric: 'Award marks for: average vs distribution; tail-loss concentration; pricing implication.',
  },
  lt_q_c_to_d_impact: {
    id: 'lt_q_c_to_d_impact', module: 'm1', type: 'text',
    label: 'Impact of a loan moving from C to D after collateral edit',
    modelAnswer: 'C->D raises expected loss severity and enforcement dependence, lowers recovery expectations, and reduces supportable bid capacity.',
    rubric: 'Award marks for: direction on loss/recovery; LTV-cushion mechanism; bid-capacity impact.',
  },
  sum_q_largest_step: {
    id: 'sum_q_largest_step', module: 'm1', type: 'text',
    label: 'Largest incremental value step in return bridge and why',
    modelAnswer: 'Strong answer identifies the largest observed bridge step and ties it to a concrete mechanism: timing pull-forward, loss reduction, or financing effect.',
    rubric: 'Award marks for: plausible largest step; causal mechanism; relevance to bid/IC decision.',
  },
  sum_q_single_irr_risk: {
    id: 'sum_q_single_irr_risk', module: 'm1', type: 'text',
    label: 'How IRR and MoIC evolve across active resolution steps',
    modelAnswer: 'As A/B/C strategies are layered in, IRR typically rises because cash is pulled forward (faster monetization and shorter duration). MoIC can rise less, flatten, or even decline because some strategies exchange longer carry for earlier certainty (timing benefit vs total cash benefit). A-sale often gives the clearest timing uplift, B-cure adds value through cure cash plus re-performing sale execution, and C-DPO improves certainty/timing but may haircut nominal claims. The key takeaway is that IRR is more timing-sensitive, while MoIC is more total-cash sensitive.',
    rubric: 'Award marks for: describing direction of IRR and MoIC through A/B/C steps; correctly explaining timing-vs-total-cash mechanics; at least one strategy-specific mechanism (A, B, or C) tied to metric movement.',
  },
  sum_q_sensitivity_first: {
    id: 'sum_q_sensitivity_first', module: 'm1', type: 'text',
    label: 'How to adjust active-resolution mix to target 1.5x MoIC',
    modelAnswer: 'To target a higher MoIC (e.g., 1.5x), the strategy usually shifts toward maximizing total cash capture rather than only accelerating timing. Examples: be more selective on A sales (hold stronger carry assets when sale pricing is weak), tighten B-cure execution criteria to prioritize higher-certainty cures/sale exits, and re-underwrite C-DPO terms to avoid over-discounting principal where enforcement-adjusted hold value is better. This may reduce some IRR timing benefit but can improve cumulative proceeds and therefore MoIC, provided execution risk remains controlled.',
    rubric: 'Award marks for: proposing a credible strategy adjustment (not just “bid lower”); explicit link to improving total cash/MoIC; acknowledgment of trade-offs (e.g., timing/IRR or execution risk) and why the approach could still be superior.',
  },

  // Portfolio Composition (m1b)
  pc_q_avg_not_lowrisk: {
    id: 'pc_q_avg_not_lowrisk', module: 'm1b', type: 'text',
    label: 'Why portfolio can be risky even with average LTV below 100%',
    modelAnswer: 'Risk is non-linear by bucket; D-tail can carry structural shortfalls. Losses come from impaired cohorts, not portfolio mean.',
    rubric: 'Award marks for: heterogeneity/non-linearity; D-loss concentration; bid conservatism implication.',
  },
  pc_q_worst_cohort: {
    id: 'pc_q_worst_cohort', module: 'm1b', type: 'text',
    label: 'Cohort (risk and state) with largest recovery risk and why',
    modelAnswer: 'Strong answer names one Risk x State cohort from the cross-tab and explains that recovery risk is highest where collateral shortfall is deepest and resolution is slower or costlier, which lowers net present recovery and increases uncertainty.',
    rubric: 'Award marks for: specific Risk x State cohort named; recovery-risk mechanism (shortfall and/or timing/cost) explained; clear impact on recovery value/uncertainty.',
  },

  // Performing Baseline (m2)
  pb_q_upper_bound: {
    id: 'pb_q_upper_bound', module: 'm2', type: 'text',
    label: 'Why performing baseline is an upper bound',
    modelAnswer: 'Assumes full performance and no distress frictions, and treats the portfolio as if it is entirely comprised of performing loans. Real NPL outcomes include losses, delays, and costs, so realized returns are lower.',
    rubric: 'Award marks for: perfect-performance assumption; missing frictions; ceiling interpretation.',
  },
  pb_q_timing_vs_irr: {
    id: 'pb_q_timing_vs_irr', module: 'm2', type: 'text',
    label: 'Export CSV results: state IRR, MoIC, profit, and explain why IRR differs from coupon',
    modelAnswer: 'Use the exported baseline cash flow to report portfolio IRR, MoIC, and total profit, then explain the rate gap: coupon is a contractual loan yield on outstanding principal, while IRR is an equity-style, time-weighted return on the purchase cash flow stream (including principal timing and any premium/discount to par). As a result, IRR can differ from the weighted average coupon even when all loans perform.',
    rubric: 'Award marks for: correctly reporting IRR, MoIC, and profit from the export; clearly distinguishing coupon vs IRR definitions; explanation of timing/cash-flow-structure effects (and price basis if relevant); coherent linkage to why the two rates differ.',
  },

  // Recovery Analysis (m3)
  ra_q_floor_definition: {
    id: 'ra_q_floor_definition', module: 'm3', type: 'text',
    label: 'Recovery shortfall and why it reduces max bid',
    modelAnswer: 'Recovery shortfall is the gap between loan balance and what collateral actually recovers at resolution (i.e., unrecovered principal). That shortfall is a direct loss of cash to the buyer, which lowers total proceeds and present value. To still achieve the target IRR, the investor must pay less upfront, so maximum bid price falls as expected shortfall rises.',
    rubric: 'Award marks for: clear plain-language definition of recovery shortfall (balance minus recoverable collateral); explicit link to lower cash recovery/PV; correct bid-capacity logic (higher shortfall => lower max bid for same target IRR).',
  },
  ra_q_worse_than_floor: {
    id: 'ra_q_worse_than_floor', module: 'm3', type: 'text',
    label: 'Collateral value-cycle assumption and impact on bid/returns',
    modelAnswer: 'The value-change assumption sets forecast collateral at maturity, which drives recovery and loss severity through min(balance, collateral value). In a rising cycle, projected collateral is higher, shortfalls shrink, recoveries improve, and both supportable bid and expected IRR tend to increase. In a falling cycle, projected collateral is lower, shortfalls widen, losses increase, and required bid discounts are larger; if bid is unchanged, expected IRR declines.',
    rubric: 'Award marks for: explaining how value assumptions feed into recovery math; correct rising-vs-falling directional effects on recovery/losses; clear flow-through to bid capacity and returns (or IRR if price is held fixed).',
  },

  // Enforcement (m_enf)
  enf_q_cost_timing_bid: {
    id: 'enf_q_cost_timing_bid', module: 'm_enf', type: 'text',
    label: 'Why D-loans often require enforcement to resolve',
    modelAnswer: 'D-loans are typically underwater (LTV > 100%), so borrowers have limited or negative equity and weak incentive to contribute fresh capital, cure arrears, or refinance at par. Without economic incentive to cooperate, voluntary outcomes are less likely and lender recovery often requires legal enforcement to take control of collateral and convert it to cash.',
    rubric: 'Award marks for: clear borrower-incentive logic (negative/limited equity); explanation of why voluntary cure/refi is unlikely; explicit link to enforcement as the practical recovery mechanism.',
  },
  enf_q_delay_d_vs_a: {
    id: 'enf_q_delay_d_vs_a', module: 'm_enf', type: 'text',
    label: 'Why enforcement is the base/worst-case floor for D-loans and bid setting',
    modelAnswer: 'For D-loans, enforcement is treated as the base/worst-case path because it is the coercive route available when cooperative resolutions fail: slower timelines, legal costs, and typically lower net recovery than consensual outcomes. It provides a conservative floor for underwriting because any negotiated strategy should be judged against what can be recovered through enforcement. Bid price should therefore be supportable even on this floor case; upside strategies can add value above it but should not be required just to justify the entry price.',
    rubric: 'Award marks for: framing enforcement as coercive worst/base case for D-loans; identifying timeline/cost/recovery drag; explaining floor logic for bid setting (price must clear downside case, upside optionality above floor).',
  },

  // Active Resolution (m4) - A/B/C only
  ar_a_q_irr_moic: {
    id: 'ar_a_q_irr_moic', module: 'm4', type: 'text',
    label: 'A-sale: value creation mechanism and return trade-off',
    modelAnswer: 'A-sale creates value by monetizing stronger credits earlier, pulling forward cash and reducing duration/execution exposure versus passive hold. The trade-off is timing versus total carry: earlier proceeds usually improve IRR, but selling can reduce total coupon collection and therefore MoIC relative to full hold-to-maturity cashflows.',
    rubric: 'Award marks for: clear early-monetization mechanism; explicit IRR (timing) vs MoIC (total-cash) trade-off; comparison to passive hold logic.',
  },
  ar_a_q_sell_vs_hold: {
    id: 'ar_a_q_sell_vs_hold', module: 'm4', type: 'text',
    label: 'A-sale: impact of yield widening on proceeds, bid, and returns',
    modelAnswer: 'If market yields demanded by buyers rise, A-loan sale prices fall (inverse price-yield relationship). Lower sale proceeds reduce active-resolution cash inflow and compress supportable bid capacity for the same target IRR. If bid is not adjusted down, expected IRR declines; if bid is reduced, IRR can be preserved but entry price must be lower.',
    rubric: 'Award marks for: correct price-yield direction; flow-through from lower proceeds to bid capacity; correct IRR implication under fixed-bid vs adjusted-bid framing.',
  },
  ar_b_q_wait_trackrecord: {
    id: 'ar_b_q_wait_trackrecord', module: 'm4', type: 'text',
    label: 'B-cure: why cure before re-performing sale',
    modelAnswer: 'The cure step reduces balance (denominator cure), improves LTV/credit profile, and converts a covenant-breached loan into saleable re-performing paper. Economically, cure cash is an immediate inflow and de-risks the residual exposure, enabling better exit pricing than selling uncured stress. Without cure, re-performing buyers apply wider yields/haircuts or may not transact.',
    rubric: 'Award marks for: denominator-cure mechanics; link from improved credit profile to saleability/pricing; clear statement of what is lost if cure fails.',
  },
  ar_b_q_execution_bridge: {
    id: 'ar_b_q_execution_bridge', module: 'm4', type: 'text',
    label: 'B-cure: go/no-go triggers and return impact',
    modelAnswer: 'A strong answer sets explicit pivot triggers, for example: (1) cure participation below a threshold (e.g., too few borrowers curing by the deadline), and (2) post-cure exit pricing widening (required sale yields too high to justify planned proceeds). If either trigger is hit, Heron should switch to an alternate path (hold/enforcement/renegotiation). In the model this shows up as delayed/smaller B inflows, weaker B-step bridge uplift, lower bid support, and reduced IRR/MoIC unless entry price is adjusted.',
    rubric: 'Award marks for: two concrete, measurable trigger points; clear alternative action if trigger is breached; explicit mapping from trigger breach to model outputs (timing/proceeds, bridge step, bid and/or IRR/MoIC).',
  },
  ar_c_q_rate_split: {
    id: 'ar_c_q_rate_split', module: 'm4', type: 'text',
    label: 'C-DPO: why both lender and borrower may prefer a negotiated payoff',
    modelAnswer: 'A DPO can be value-accretive for both sides: borrower gets certainty and debt relief versus full contractual payoff, while lender receives earlier, more certain cash and avoids some legal/timing friction. Relative to waiting or enforcing, DPO exchanges some nominal claim for reduced duration and execution risk, which can improve risk-adjusted value if priced correctly.',
    rubric: 'Award marks for: two-sided incentive explanation (borrower + lender); timing/certainty vs nominal-claim trade-off; comparison against wait/enforcement alternatives.',
  },
  ar_c_q_high_rate_execution: {
    id: 'ar_c_q_high_rate_execution', module: 'm4', type: 'text',
    label: 'C-DPO: key sensitivities and impact of weaker refinancing markets',
    modelAnswer: 'C-DPO outcomes are most sensitive to borrower refinance capacity, discount-rate assumptions (principal/interest), and execution timing. In a weaker refinancing market, borrowers have less access to take-out capital, so close probability drops, timelines extend, and expected proceeds are typically revised down (or shifted later), reducing bid support and IRR unless entry price is lowered.',
    rubric: 'Award marks for: naming core DPO sensitivities; explaining weaker-refi-market effect on probability/timing/proceeds; clear bid/IRR consequence.',
  },

  // Financing (m5)
  fin_q_leverage_mechanic: {
    id: 'fin_q_leverage_mechanic', module: 'm5', type: 'text',
    label: 'Mechanical reason LoL can increase levered IRR',
    modelAnswer: 'Debt reduces equity base. If asset return exceeds debt cost, spread accrues to smaller equity denominator, raising levered IRR despite financing costs.',
    rubric: 'Award marks for: denominator effect; positive leverage condition; financing-cost caveat.',
  },
  fin_q_release_liquidity: {
    id: 'fin_q_release_liquidity', module: 'm5', type: 'text',
    label: 'Why release price should be above advance rate (APP basis)',
    modelAnswer: 'If release price (% of APP) is above advance rate, each resolution event forces debt paydown faster than collateral is being released, creating principal de-levering and preserving lender over-collateralization. This protects the lender against adverse selection and timing risk as better loans repay first and weaker loans remain. If release is at or below advance, outstanding debt can stay too high relative to remaining collateral, increasing tail risk, refinancing pressure, and potential covenant/liquidity stress for both lender and equity.',
    rubric: 'Award marks for: stating de-levering/credit-protection logic (release > advance); identifying adverse-selection and remaining-collateral coverage risk; explaining consequences if release <= advance (higher tail leverage, liquidity/refi stress).',
  },
  fin_q_neg_leverage_signals: {
    id: 'fin_q_neg_leverage_signals', module: 'm5', type: 'text',
    label: 'Early warning signals of approaching negative leverage',
    modelAnswer: 'Watch shrinking unlevered-debt spread, delayed recoveries, cost inflation, and weaker early cash coverage; these erode leverage benefit before terminal metrics.',
    rubric: 'Award marks for: spread compression; timing/cost indicators; forward-looking risk logic.',
  },

  // IC Memo (m_ic)
  ic_bid_price: {
    id: 'ic_bid_price', module: 'm_ic', type: 'numeric',
    label: 'Recommended bid price ($m)',
    modelAnswer: 'Auto-graded: within $5m of the Active Resolution 12.5% IRR bid price from Module 3 model output.',
  },
  ic_target_irr: {
    id: 'ic_target_irr', module: 'm_ic', type: 'numeric',
    label: 'Target unlevered IRR (%)',
    modelAnswer: 'Auto-graded: 12.5% (Heron IC hurdle). Accept 12.0%-13.0%.',
  },
  ic_thesis: {
    id: 'ic_thesis', module: 'm_ic', type: 'text',
    label: 'Investment Thesis: In 3-5 sentences, why is this portfolio an attractive investment for Heron Capital at this price and point in the cycle? Reference macro context, collateral quality, and expected return.',
    modelAnswer: `This portfolio is attractive because it offers distressed entry pricing in a market still adjusting to higher rates, where resolution skill can create value. The collateral-backed structure and bucket mix provide multiple resolution paths rather than a single binary outcome. At the recommended bid, Heron can target returns above its 12.5% unlevered hurdle through active management rather than passive carry. The key risk is that judicial timelines and D-loan severity can delay cash flows and compress IRR if execution slips.`,
    rubric: 'Award marks for: 3-5 sentence structure followed; macro/cycle context included; portfolio quality/composition linked to thesis; return-above-hurdle logic stated; at least one specific risk noted.\nSCORING: 3 = all elements present with clear causal logic; 2 = most elements present with minor gap; 1 = generic thesis with limited mechanism; 0 = missing/off-topic.',
  },
  ic_portfolio_analysis: {
    id: 'ic_portfolio_analysis', module: 'm_ic', type: 'text',
    label: 'Portfolio Analysis: Describe the portfolio composition. Key risk characteristics? Which cohorts concern you most and why?',
    modelAnswer: `The portfolio spans A/B/C/D cohorts, but risk is concentrated in higher-LTV segments where collateral coverage is thin or negative. D-loans are the main concern because expected principal shortfalls are largest and recovery depends heavily on resolution outcomes. Within that cohort, judicial-state exposure is critical because slower and costlier enforcement reduces present value. Concentration in specific states and borrower clusters can amplify this downside. Key mitigants are first-lien collateral, diversified loan count, and multiple active resolution options across cohorts.`,
    rubric: 'Award marks for: clear cohort composition summary; D-loans identified as primary loss driver; judicial timing/cost impact explained; concentration risk discussed; at least one mitigant included.\nSCORING: 3 = all five with mechanism; 2 = three-to-four with mostly correct logic; 1 = partial description without causal depth; 0 = missing/off-topic.',
  },
  ic_scenario_commentary: {
    id: 'ic_scenario_commentary', module: 'm_ic', type: 'text',
    label: 'Outcome range: quantify downside/base/upside and explain active-management drivers',
    modelAnswer: `A strong answer quantifies a plausible downside/base/upside range (for example, bid support and/or IRR/MoIC) and ties each case to explicit execution assumptions. Downside typically reflects weaker A-sale pricing, lower B-cure conversion, softer C-DPO closes, and/or longer judicial timelines. Base case reflects modeled assumptions. Upside reflects stronger sale execution, better cure participation, and tighter DPO outcomes. The key insight is that active management changes both expected value and dispersion by improving timing and recovery pathways versus passive outcomes.`,
    rubric: 'Award marks for: explicit quantified range (downside/base/upside) using model-consistent metrics; clear mapping from each case to active-resolution assumptions (A/B/C and/or D timing context); explanation of how active management shifts both expected return and risk distribution.\nSCORING: 3 = quantified, assumption-linked, decision-useful range; 2 = mostly complete with minor gaps in quantification or linkage; 1 = qualitative commentary with limited quantification; 0 = missing/off-topic.',
  },
  ic_financing: {
    id: 'ic_financing', module: 'm_ic', type: 'text',
    label: 'Financing Structure: Describe the LoL financing. Is fixed rate appropriate? What are the key risks given the resolution timeline?',
    modelAnswer: `The LoL structure can improve equity returns when unlevered asset performance stays above the debt cost after fees and timing drag. A fixed rate is useful for underwriting certainty, but its attractiveness depends on the expected rate path and opportunity cost versus floating alternatives. The main risk is timing mismatch: debt service and release requirements may arrive before slower recoveries, especially in long judicial resolutions. If resolution performance weakens, spread compression can push the structure toward negative leverage and reduce equity resilience.`,
    rubric: 'Award marks for: positive leverage condition stated; fixed-vs-floating trade-off discussed; timing/liquidity risk explained; downside/negative-leverage case acknowledged.\nSCORING: 3 = all four with clear mechanism; 2 = three of four with minor gaps; 1 = generic financing comments with limited causality; 0 = missing/off-topic.',
  },
  ic_risks: {
    id: 'ic_risks', module: 'm_ic', type: 'text',
    label: 'Key Risks & Mitigants: Identify the top 3-4 risks to this investment thesis. For each risk, describe the mitigant and how it is reflected in the model.',
    modelAnswer: `1) Judicial timeline risk: delayed D-loan recoveries reduce PV; mitigant is deeper pricing for judicial exposure and active legal workout strategy reflected in timing assumptions.\n2) Collateral downside risk: further valuation declines increase loss severity; mitigant is conservative recovery assumptions and downside sensitivity tests.\n3) Execution risk in B-cure/C-DPO: expected cures or negotiated payoffs may fail or delay; mitigant is underwriting haircuts and fallback resolution paths.\n4) Financing/liquidity risk: release and debt-service timing can pressure equity cash; mitigant is stress-testing cash timing and maintaining spread cushion above debt cost.`,
    rubric: 'Award marks for: 3-4 distinct risks listed; each risk paired with a concrete mitigant; at least two risks explicitly linked to model assumptions/sensitivities; causal logic between risk and return impact.\nSCORING: 3 = all requirements met with clear pairings; 2 = good coverage but one weak or missing linkage; 1 = risks listed with thin mitigants/mechanism; 0 = missing/off-topic.',
  },
  ic_recommendation: {
    id: 'ic_recommendation', module: 'm_ic', type: 'text',
    label: 'Recommendation: Buy or Pass? Provide your recommended bid price, rationale, and the 2-3 conditions that must hold for the investment to succeed.',
    modelAnswer: `Recommendation: BUY at or below the modeled active-resolution bid that supports a 12.5% unlevered IRR. The rationale is that active management can recover value above the passive floor while maintaining downside discipline through pricing. Success conditions: (1) A/B/C strategy execution occurs broadly in line with modeled timing; (2) judicial D-loan resolutions do not materially exceed assumed timeline/cost; (3) financing remains positively levered with adequate cash coverage. If these conditions deteriorate materially, the bid should be reduced or the deal should be passed.`,
    rubric: 'Award marks for: explicit Buy/Pass decision; bid level stated and linked to return framework; rationale ties strategy to value creation; 2-3 specific, testable success conditions included.\nSCORING: 3 = complete and decision-ready recommendation; 2 = mostly complete with one weak element; 1 = generic recommendation without testable conditions; 0 = missing/off-topic.',
  },
};

export const MODULE_QUESTION_ORDER: Record<string, string[]> = {
  m0: [],
  m1: ['sum_q_largest_step', 'sum_q_single_irr_risk', 'sum_q_sensitivity_first'],
  m1b: ['pc_q_avg_not_lowrisk', 'pc_q_worst_cohort'],
  m2: ['pb_q_upper_bound', 'pb_q_timing_vs_irr'],
  m3: ['ra_q_floor_definition', 'ra_q_worse_than_floor'],
  m_enf: ['enf_q_cost_timing_bid', 'enf_q_delay_d_vs_a'],
  m4: ['ar_a_q_irr_moic', 'ar_a_q_sell_vs_hold', 'ar_b_q_wait_trackrecord', 'ar_b_q_execution_bridge', 'ar_c_q_rate_split', 'ar_c_q_high_rate_execution'],
  m5: ['fin_q_leverage_mechanic', 'fin_q_release_liquidity'],
  m_ic: ['ic_bid_price', 'ic_target_irr', 'ic_thesis', 'ic_portfolio_analysis', 'ic_scenario_commentary', 'ic_financing', 'ic_risks', 'ic_recommendation'],
};
