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
