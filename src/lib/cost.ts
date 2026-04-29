// Monthly cost calculations for the regimen stack.

import type { Item } from "./types";

/**
 * Compute monthly cost in USD for a single item.
 * Returns null if either unit_cost or days_supply is missing.
 */
export function monthlyCostFor(item: Item): number | null {
  if (!item.unit_cost || !item.days_supply || item.days_supply <= 0) return null;
  return (Number(item.unit_cost) / item.days_supply) * 30;
}

export type CostBreakdown = {
  totalMonthly: number;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
  trackedCount: number;
  untrackedCount: number;
  topItems: { name: string; monthly: number }[];
};

/**
 * Aggregate cost across a list of items.
 */
export function computeCostBreakdown(items: Item[]): CostBreakdown {
  const breakdown: CostBreakdown = {
    totalMonthly: 0,
    byCategory: {},
    byType: {},
    trackedCount: 0,
    untrackedCount: 0,
    topItems: [],
  };
  const itemCosts: { name: string; monthly: number }[] = [];

  for (const item of items) {
    if (item.status !== "active") continue;
    const m = monthlyCostFor(item);
    if (m == null) {
      breakdown.untrackedCount++;
      continue;
    }
    breakdown.trackedCount++;
    breakdown.totalMonthly += m;
    breakdown.byCategory[item.category] =
      (breakdown.byCategory[item.category] ?? 0) + m;
    breakdown.byType[item.item_type] =
      (breakdown.byType[item.item_type] ?? 0) + m;
    itemCosts.push({ name: item.name, monthly: m });
  }

  breakdown.topItems = itemCosts
    .sort((a, b) => b.monthly - a.monthly)
    .slice(0, 8);

  return breakdown;
}

export function formatUSD(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function formatUSDRound(n: number): string {
  return `$${Math.round(n)}`;
}

/** A "waste candidate" — paying-for-but-barely-taking. Flagged when the
 *  user has at least 14 days of stack-log history, adherence is below
 *  the threshold, and monthly cost is non-trivial.
 *
 *  Why these defaults:
 *   - 14-day window: short enough to react, long enough to filter noise
 *   - 50% adherence: anything lower means the user is actively avoiding it
 *   - $15/mo: avoids flagging cheap items where cost > effort to drop
 */
export type WasteCandidate = {
  item_id: string;
  item_name: string;
  monthly_cost: number;
  adherence_rate: number;
  taken_count: number;
  total_count: number;
  /** Annualized waste = monthly_cost * 12 * (1 - adherence_rate). */
  annualized_waste: number;
};

export type StackLogRow = {
  item_id: string;
  taken: boolean;
  date: string;
};

/** Compute waste candidates given items + recent stack_log rows.
 *
 *  Pure function — caller does the DB query and passes the data in. */
export function findWasteCandidates(
  items: Item[],
  stackLog: StackLogRow[],
  opts: {
    /** Adherence threshold below which an item is suspicious. Default 0.5. */
    adherenceMax?: number;
    /** Monthly cost floor — anything cheaper isn't worth the friction
     *  of flagging. Default $15. */
    monthlyCostMin?: number;
    /** Minimum total log rows required for the rate to be trustworthy.
     *  Default 7 — avoids flagging brand-new items. */
    minLogRows?: number;
  } = {},
): WasteCandidate[] {
  const adherenceMax = opts.adherenceMax ?? 0.5;
  const monthlyCostMin = opts.monthlyCostMin ?? 15;
  const minLogRows = opts.minLogRows ?? 7;

  // Aggregate stack_log per item_id.
  const agg = new Map<string, { taken: number; total: number }>();
  for (const row of stackLog) {
    const e = agg.get(row.item_id) ?? { taken: 0, total: 0 };
    e.total += 1;
    if (row.taken) e.taken += 1;
    agg.set(row.item_id, e);
  }

  const out: WasteCandidate[] = [];
  for (const item of items) {
    if (item.status !== "active") continue;
    const monthly = monthlyCostFor(item);
    if (monthly == null || monthly < monthlyCostMin) continue;
    const stats = agg.get(item.id);
    if (!stats || stats.total < minLogRows) continue;
    const rate = stats.taken / stats.total;
    if (rate >= adherenceMax) continue;
    out.push({
      item_id: item.id,
      item_name: item.name,
      monthly_cost: Math.round(monthly * 100) / 100,
      adherence_rate: Math.round(rate * 100) / 100,
      taken_count: stats.taken,
      total_count: stats.total,
      annualized_waste: Math.round(monthly * 12 * (1 - rate) * 100) / 100,
    });
  }

  // Highest waste first
  out.sort((a, b) => b.annualized_waste - a.annualized_waste);
  return out;
}
