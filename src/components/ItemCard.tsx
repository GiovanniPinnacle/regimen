"use client";

import Link from "next/link";
import type { Item } from "@/lib/types";
import CategoryBadge from "./CategoryBadge";
import { GOAL_LABELS, ITEM_TYPE_ICONS } from "@/lib/constants";

type Props = {
  item: Item;
  taken?: boolean;
  onToggle?: (id: string) => void;
  onSkip?: (item: Item) => void;
  skipReason?: string | null;
  showGoals?: boolean;
  showTrigger?: boolean;
  showTypeIcon?: boolean;
};

export default function ItemCard({
  item,
  taken,
  onToggle,
  onSkip,
  skipReason,
  showGoals = true,
  showTrigger = false,
  showTypeIcon = true,
}: Props) {
  const interactive = typeof onToggle === "function";
  const typeIcon = ITEM_TYPE_ICONS[item.item_type] ?? "";
  const skipped = !taken && !!skipReason;

  return (
    <div
      className="border-hair rounded-xl p-4 flex items-start gap-3 transition-colors"
      style={{
        background:
          taken || skipped ? "var(--surface-alt)" : "var(--background)",
        opacity: taken ? 0.72 : skipped ? 0.55 : 1,
      }}
    >
      {interactive ? (
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
      ) : showTypeIcon && typeIcon ? (
        <div
          className="mt-0.5 shrink-0 h-6 w-6 flex items-center justify-center text-[15px] leading-none"
          aria-hidden
        >
          {typeIcon}
        </div>
      ) : null}

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              href={`/items/${item.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[15px] leading-snug truncate block hover:underline"
              style={{
                fontWeight: 500,
                textDecoration: taken ? "line-through" : undefined,
                textDecorationColor: "var(--muted)",
              }}
            >
              {item.name}
            </Link>
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
          {item.dose ?? "—"}
          {item.schedule_rule?.notes && (
            <span> · {item.schedule_rule.notes}</span>
          )}
        </div>

        {item.usage_notes && !skipped && (
          <div
            className="text-[12px] mt-1.5 leading-relaxed whitespace-pre-line"
            style={{ color: "var(--foreground)", opacity: 0.85 }}
          >
            {item.usage_notes}
          </div>
        )}

        {skipped && skipReason && (
          <div
            className="text-[12px] mt-1.5"
            style={{ color: "var(--muted)", fontStyle: "italic" }}
          >
            Skipped: {skipReason}
          </div>
        )}

        {interactive && !taken && !skipped && onSkip && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSkip(item);
            }}
            className="text-[11px] mt-2"
            style={{ color: "var(--muted)", textDecoration: "underline" }}
          >
            Skip with reason
          </button>
        )}

        {item.notes && !item.usage_notes && (
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

        {item.__companions && item.__companions.length > 0 && (
          <div
            className="mt-3 pt-3 flex flex-col gap-1.5"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{ color: "var(--muted)", fontWeight: 500 }}
            >
              Companions
            </div>
            {item.__companions.map((c) => (
              <div
                key={c.id}
                className="flex items-baseline gap-2 text-[13px]"
                style={{ color: "var(--muted)" }}
              >
                <span>+</span>
                <span style={{ fontWeight: 500, color: "var(--foreground)" }}>
                  {c.name}
                </span>
                {c.dose && <span>· {c.dose}</span>}
                {c.companion_instruction && (
                  <span style={{ fontStyle: "italic" }}>
                    · {c.companion_instruction}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
