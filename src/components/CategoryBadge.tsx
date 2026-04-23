import { CATEGORY_COLORS } from "@/lib/constants";
import type { Category } from "@/lib/types";

export default function CategoryBadge({
  category,
  size = "sm",
}: {
  category: Category;
  size?: "sm" | "xs";
}) {
  const spec = CATEGORY_COLORS[category];
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
