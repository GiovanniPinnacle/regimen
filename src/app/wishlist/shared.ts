// Shared constants for the /wishlist screen (page, row, add sheet).

import type { WishlistPriority } from "@/lib/types";

export const PRIORITY_ORDER: WishlistPriority[] = ["high", "medium", "low"];

/** Priority is a ranking, not an alarm: neutral inks with a warm dot
 *  for "high" only. Never red (error) or gold (buy-only). */
export const PRIORITY_META: Record<
  WishlistPriority,
  { label: string; long: string; dot: string }
> = {
  high: { label: "High", long: "High priority", dot: "var(--warn)" },
  medium: { label: "Medium", long: "Medium priority", dot: "var(--foreground-soft)" },
  low: { label: "Low", long: "Low priority", dot: "var(--border-strong)" },
};

export const PRIORITY_RANK: Record<WishlistPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export type SortMode = "priority" | "price_desc" | "price_asc" | "newest";

export const SORT_LABELS: Record<SortMode, string> = {
  priority: "Priority",
  price_desc: "Price: high to low",
  price_asc: "Price: low to high",
  newest: "Newest",
};

export function fmtDollars(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}
