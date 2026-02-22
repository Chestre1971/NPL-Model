/**
 * Portfolio statistics calculations for Module 1 / Q1.
 */
import type { Loan } from '../data/loanTape';
import { parseDate, fmtDate } from './dateUtils';

export interface PortfolioStats {
  totalLoans: number;
  totalDebtBalance: number;
  totalAssets: number;
  wam: Date;           // weighted average maturity (date)
  wamYears: number;    // relative to purchase date
  wac: number;         // weighted average coupon
  waLTV: number;       // weighted average LTV
  maxRecoveries: number;
}

export interface StratRow {
  label: string;
  totalLoans: number;
  totalDebtBalance: number;
  totalAssets: number;
  wam: string;         // formatted date
  wac: number;
  waLTV: number;
}

const PURCHASE_DATE = new Date(Date.UTC(2021, 11, 31, 12)); // Dec 31, 2021

export function calcPortfolioStats(loans: Loan[]): PortfolioStats {
  if (loans.length === 0) return {
    totalLoans: 0, totalDebtBalance: 0, totalAssets: 0,
    wam: new Date(), wamYears: 0, wac: 0, waLTV: 0, maxRecoveries: 0,
  };

  const totalDebt = loans.reduce((s, l) => s + l.amount, 0);
  const totalAssets = loans.reduce((s, l) => s + l.assets, 0);

  // WAM = weighted average maturity in days from epoch
  const wamMs = loans.reduce((s, l) => {
    const d = parseDate(l.maturity);
    return s + (l.amount / totalDebt) * d.getTime();
  }, 0);
  const wam = new Date(wamMs);

  const wamYears = (wam.getTime() - PURCHASE_DATE.getTime()) / (365.25 * 86400000);

  const wac = loans.reduce((s, l) => s + (l.amount / totalDebt) * l.coupon, 0);
  const waLTV = loans.reduce((s, l) => s + (l.amount / totalDebt) * l.ltv, 0);

  // Max recoveries = sum of min(amount, collateralValue)
  const maxRecoveries = loans.reduce((s, l) => s + Math.min(l.amount, l.collateralValue), 0);

  return { totalLoans: loans.length, totalDebtBalance: totalDebt, totalAssets, wam, wamYears, wac, waLTV, maxRecoveries };
}

export function calcStratRow(label: string, loans: Loan[]): StratRow {
  if (loans.length === 0) return { label, totalLoans: 0, totalDebtBalance: 0, totalAssets: 0, wam: 'n/a', wac: 0, waLTV: 0 };
  const stats = calcPortfolioStats(loans);
  return {
    label,
    totalLoans: stats.totalLoans,
    totalDebtBalance: stats.totalDebtBalance,
    totalAssets: stats.totalAssets,
    wam: fmtDate(stats.wam),
    wac: stats.wac,
    waLTV: stats.waLTV,
  };
}

/** Stratify by a string field (e.g. riskFactor or jurisdiction). */
export function stratifyBy(loans: Loan[], field: keyof Loan): StratRow[] {
  const groups = new Map<string, Loan[]>();
  for (const loan of loans) {
    const key = String(loan[field]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(loan);
  }
  // Sort keys
  const keys = Array.from(groups.keys()).sort();
  const rows = keys.map(k => calcStratRow(k, groups.get(k)!));
  rows.push(calcStratRow('Total', loans));
  return rows;
}

/** Cross-tab: by risk factor then by jurisdiction. */
export function crossTabRiskJurisdiction(loans: Loan[]): Record<string, StratRow[]> {
  const riskFactors = ['A', 'B', 'C', 'D'];
  const result: Record<string, StratRow[]> = {};
  for (const rf of riskFactors) {
    const rfLoans = loans.filter(l => l.riskFactor === rf);
    result[rf] = stratifyBy(rfLoans, 'jurisdiction');
  }
  return result;
}
