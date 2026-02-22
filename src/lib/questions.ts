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
    label: 'Why one final IRR number is insufficient without bridge decomposition',
    modelAnswer: 'Single IRR hides source of value and execution dependence. Bridge shows what is robust vs assumption-sensitive and improves risk-adjusted decisions.',
    rubric: 'Award marks for: limitation of one-number view; risk attribution via bridge; decision-quality implication.',
  },
  sum_q_sensitivity_first: {
    id: 'sum_q_sensitivity_first', module: 'm1', type: 'text',
    label: 'First downside sensitivity to test and why',
    modelAnswer: 'Pick highest-elasticity driver (often D timing/cost/recovery or DPO execution), explain mechanism and underwriting impact.',
    rubric: 'Award marks for: selecting plausible high-impact variable; mechanism; pricing implication.',
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
    label: 'Worst risk-state cohort and why it deserves deeper discount',
    modelAnswer: 'Worst cohort combines high expected shortfall with slower/costly resolution, causing lower PV and greater uncertainty, requiring deeper discount.',
    rubric: 'Award marks for: coherent cohort selection; severity + timing/cost logic; discount implication.',
  },

  // Performing Baseline (m2)
  pb_q_upper_bound: {
    id: 'pb_q_upper_bound', module: 'm2', type: 'text',
    label: 'Why performing baseline is an upper bound',
    modelAnswer: 'Assumes full performance and no distress frictions. Real NPL outcomes include losses, delays, and costs, so realized returns are lower.',
    rubric: 'Award marks for: perfect-performance assumption; missing frictions; ceiling interpretation.',
  },
  pb_q_timing_vs_irr: {
    id: 'pb_q_timing_vs_irr', module: 'm2', type: 'text',
    label: 'Why similar total cash can have different IRR',
    modelAnswer: 'IRR is time-weighted. Earlier cash raises IRR and delayed cash lowers IRR even if nominal totals are similar.',
    rubric: 'Award marks for: timing sensitivity of IRR; early vs late cash effect; distinction from total-cash view.',
  },

  // Recovery Analysis (m3)
  ra_q_floor_definition: {
    id: 'ra_q_floor_definition', module: 'm3', type: 'text',
    label: 'Why recovery analysis is the floor scenario and what it excludes',
    modelAnswer: 'It is passive hold-to-resolution with no active value-add. It excludes upside from active strategies and is conditional on assumptions holding.',
    rubric: 'Award marks for: passive-floor logic; exclusion of active upside; assumption-conditional caveat.',
  },
  ra_q_worse_than_floor: {
    id: 'ra_q_worse_than_floor', module: 'm3', type: 'text',
    label: 'When realized returns can be worse than modeled floor',
    modelAnswer: 'Examples: further collateral decline, longer legal timelines, higher costs, appraisal error, execution slippage. Each reduces recovery or delays cash and lowers IRR.',
    rubric: 'Award marks for: at least three valid factors; causal mechanism for each; IRR/valuation linkage.',
  },

  // Enforcement (m_enf)
  enf_q_cost_timing_bid: {
    id: 'enf_q_cost_timing_bid', module: 'm_enf', type: 'text',
    label: 'Quantify NJ/J cost sensitivity and explain flow-through to bid/IRR',
    modelAnswer: 'Higher cost assumptions reduce net D recovery, judicial more than NJ due to larger cost/timing drag. Lower net PV requires lower bid for target IRR; unchanged bid reduces IRR.',
    rubric: 'Award marks for: correct direction and relative size; cost+timing mechanism; bid/IRR flow-through.',
  },
  enf_q_delay_d_vs_a: {
    id: 'enf_q_delay_d_vs_a', module: 'm_enf', type: 'text',
    label: 'Why enforcement delay hurts D-loans more than A-loans',
    modelAnswer: 'D relies on impaired terminal recovery with limited/no income cushion, so delay is pure PV drag. A loans are better covered and less loss-severity sensitive.',
    rubric: 'Award marks for: D vs A cashflow distinction; PV drag mechanism; pricing implication.',
  },

  // Active Resolution (m4) - A/B/C only
  ar_a_q_irr_moic: {
    id: 'ar_a_q_irr_moic', module: 'm4', type: 'text',
    label: 'A-sale: why IRR can rise while MoIC falls',
    modelAnswer: 'Early sale accelerates capital return (higher IRR) but can forgo later coupon cash (lower MoIC) depending on sale yield versus hold cashflows.',
    rubric: 'Award marks for: IRR timing effect; MoIC trade-off; yield-vs-coupon mechanism.',
  },
  ar_a_q_sell_vs_hold: {
    id: 'ar_a_q_sell_vs_hold', module: 'm4', type: 'text',
    label: 'A-sale: conditions favoring sell-now vs hold',
    modelAnswer: 'Sell-now when reinvestment opportunities and sale pricing are strong; hold when sale market is weak and carry economics are better.',
    rubric: 'Award marks for: credible sell conditions; credible hold conditions; return logic.',
  },
  ar_b_q_wait_trackrecord: {
    id: 'ar_b_q_wait_trackrecord', module: 'm4', type: 'text',
    label: 'B-cure: why wait before re-performing sale',
    modelAnswer: 'Wait to establish payment track record and reduce perceived re-default risk, improving sale pricing; trade-off is delayed capital return.',
    rubric: 'Award marks for: track-record rationale; pricing link; delay trade-off.',
  },
  ar_b_q_execution_bridge: {
    id: 'ar_b_q_execution_bridge', module: 'm4', type: 'text',
    label: 'B-cure execution risk and return-bridge effect',
    modelAnswer: 'If cures fail or re-default risk remains, repricing benefit shrinks, sales delay, and B-step uplift in the bridge compresses.',
    rubric: 'Award marks for: realistic execution risk; mechanism; bridge/IRR impact.',
  },
  ar_c_q_rate_split: {
    id: 'ar_c_q_rate_split', module: 'm4', type: 'text',
    label: 'C-DPO: why use different discount rates for principal vs interest',
    modelAnswer: 'Principal is generally better collateral-supported than distressed interest, so interest is discounted harder to reflect weaker recoverability/priority.',
    rubric: 'Award marks for: risk hierarchy; discount-rate differentiation mechanism; DPO pricing implication.',
  },
  ar_c_q_high_rate_execution: {
    id: 'ar_c_q_high_rate_execution', module: 'm4', type: 'text',
    label: 'C-DPO: effect of higher-rate market on execution',
    modelAnswer: 'Higher rates reduce borrower refinance capacity, lowering close probability and extending timelines; underwriting should stress proceeds/timing downward.',
    rubric: 'Award marks for: refinance-capacity constraint; execution/timing impact; underwriting adjustment.',
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
    label: 'Why release pricing can create equity liquidity stress',
    modelAnswer: 'Debt is repaid first from resolutions, which can leave thin near-term equity cash despite acceptable total returns, creating timing/liquidity risk.',
    rubric: 'Award marks for: debt-priority cash diversion; timing mismatch; liquidity vs total-return distinction.',
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
    label: 'Scenario Returns: Comment on the return progression across scenarios. What does the gap between Performing Baseline and Active Resolution tell you about the value of active management?',
    modelAnswer: `The Performing Baseline is a ceiling case and Recovery Analysis is the passive floor, so the spread between them quantifies value at risk from distress. Active Resolution closes part of that gap by improving timing and recoveries rather than assuming perfect performance. A-sale accelerates capital return, B-cure supports re-performance monetization, and C-DPO converts uncertain outcomes into negotiated proceeds. The remaining gap shows where D-loan enforcement friction still limits value, which is why execution quality determines whether bid assumptions are achieved.`,
    rubric: 'Award marks for: ceiling vs floor framing; explicit interpretation of the scenario gap; at least three strategy references (A/B/C and/or D enforcement context); value-creation-through-execution logic.\nSCORING: 3 = complete progression and mechanisms; 2 = mostly correct with one missing element; 1 = descriptive only with weak causal chain; 0 = missing/off-topic.',
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
  m0: ['db_q_discount_mechanism', 'db_q_round1_limits'],
  m1: ['lt_q_avg_tail', 'lt_q_c_to_d_impact', 'sum_q_largest_step', 'sum_q_single_irr_risk', 'sum_q_sensitivity_first'],
  m1b: ['pc_q_avg_not_lowrisk', 'pc_q_worst_cohort'],
  m2: ['pb_q_upper_bound', 'pb_q_timing_vs_irr'],
  m3: ['ra_q_floor_definition', 'ra_q_worse_than_floor'],
  m_enf: ['enf_q_cost_timing_bid', 'enf_q_delay_d_vs_a'],
  m4: ['ar_a_q_irr_moic', 'ar_a_q_sell_vs_hold', 'ar_b_q_wait_trackrecord', 'ar_b_q_execution_bridge', 'ar_c_q_rate_split', 'ar_c_q_high_rate_execution'],
  m5: ['fin_q_leverage_mechanic', 'fin_q_release_liquidity', 'fin_q_neg_leverage_signals'],
  m_ic: ['ic_bid_price', 'ic_target_irr', 'ic_thesis', 'ic_portfolio_analysis', 'ic_scenario_commentary', 'ic_financing', 'ic_risks', 'ic_recommendation'],
};
