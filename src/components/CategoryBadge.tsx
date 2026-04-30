import { CATEGORY_COLORS } from "@/lib/constants";
import type { Category } from "@/lib/types";

// Fallback chip styling for items whose `category` is missing or
// outside the known Category enum (legacy data, Coach proposals that
// invented a new value, or partial migrations). Without this guard,
// CATEGORY_COLORS[category] returned undefined and `.bg` access
// crashed the entire /stack page render — which is what the user was
// seeing as "stack page broken".
const UNKNOWN_CATEGORY_SPEC = {
  bg: "var(--surface-alt)",
  text: "var(--foreground-soft)",
  label: "Other",
};

export default function CategoryBadge({
  category,
  size = "sm",
}: {
  category: Category | string | null | undefined;
  size?: "sm" | "xs";
}) {
  const lookup = category
    ? CATEGORY_COLORS[category as Category]
    : undefined;
  const spec = lookup ?? UNKNOWN_CATEGORY_SPEC;
  const pad = size === "xs" ? "px-1.5 py-[1px]" : "px-2 py-0.5";
  const text = size === "xs" ? "text-[10px]" : "text-[11px]";
  return (
    <span
      className={`inline-flex items-center rounded-full ${pad} ${text}`}
      style={{
        background: spec.bg,
        color: spec.text,
        fontWeight: 500,
        letterSpacing: "0.01em",
      }}
    >
      {spec.label}
    </span>
  );
}
