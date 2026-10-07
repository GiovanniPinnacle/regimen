import { CATEGORY_COLORS } from "@/lib/constants";
import type { Category } from "@/lib/types";
import Chip from "@/components/ui/Chip";

// Neutral label for an item's category. Falls back to "Other" for
// legacy / unknown values so a bad row can't crash the page.

export default function CategoryBadge({
  category,
  size = "sm",
}: {
  category: Category | string | null | undefined;
  /** Kept for API compatibility; both render the small chip. */
  size?: "sm" | "xs";
}) {
  void size;
  const label =
    (category && CATEGORY_COLORS[category as Category]?.label) || "Other";
  return <Chip size="sm">{label}</Chip>;
}
