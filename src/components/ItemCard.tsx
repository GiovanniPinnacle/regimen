"use client";

import type { Item } from "@/lib/types";
import CategoryBadge from "./CategoryBadge";
import { GOAL_LABELS } from "@/lib/constants";

type Props = {
  item: Item;
  taken?: boolean;
  onToggle?: (id: string) => void;
  showGoals?: boolean;
  showTrigger?: boolean;
};

export default function ItemCard({
  item,
  taken,
  onToggle,
  showGoals = true,
  showTrigger = false,
}: Props) {
  const interactive = typeof onToggle === "function";

  return (
    <div
      className="border-hair rounded-xl p-4 flex items-start gap-3 transition-colors"
      style={{
        background: taken ? "var(--surface-alt)" : "var(--background)",
        opacity: taken ? 0.72 : 1,
      }}
    >
      {interactive && (
        <button
          onClick={() => onToggle?.(item.id)}
          className="mt-0.5 shrink-0 h-6 w-6 rounded-full flex items-center justify-center border-hair-strong transition-colors"
          style={{
            background: taken ? "var(--foreground)" : "transparent",
            borderColor: taken ? "var(--foreground)" : undefined,
          }}
          aria-label={taken ? "Mark as not taken" : "Mark as taken"}
        >
          {taken && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--background)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          )}
        </button>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div
              className="text-[15px] leading-snug truncate"
              style={{
                fontWeight: 500,
                textDecoration: taken ? "line-through" : undefined,
                textDecorationColor: "var(--muted)",
              }}
            >
              {item.name}
            </div>
            {item.brand && (
              <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                {item.brand}
              </div>
            )}
          </div>
          <div className="shrink-0">
            <CategoryBadge category={item.category} size="xs" />
          </div>
        </div>

        <div
          className="text-[13px] mt-1"
          style={{ color: "var(--muted)" }}
        >
          {item.dose}
          {item.schedule_rule.notes && (
            <span> · {item.schedule_rule.notes}</span>
          )}
        </div>

        {item.notes && (
          <div
            className="text-[12px] mt-1.5"
            style={{ color: "var(--muted)" }}
          >
            {item.notes}
          </div>
        )}

        {showTrigger && item.review_trigger && (
          <div
            className="text-[12px] mt-1.5"
            style={{ color: "var(--muted)", fontStyle: "italic" }}
          >
            Trigger: {item.review_trigger}
          </div>
        )}

        {showGoals && item.goals.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {item.goals.map((g) => (
              <span
                key={g}
                className="text-[10px] px-1.5 py-[1px] rounded-full border-hair"
                style={{ color: "var(--muted)" }}
              >
                {GOAL_LABELS[g]}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
