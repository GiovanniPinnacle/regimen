"use client";

import { useState } from "react";
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
  /** Compact mode (Today): hide usage_notes, notes, goals; show companions
   * count chip; tap a chevron or the Details summary for inline expand. */
  compact?: boolean;
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
  compact = false,
}: Props) {
  const interactive = typeof onToggle === "function";
  const typeIcon = ITEM_TYPE_ICONS[item.item_type] ?? "";
  const skipped = !taken && !!skipReason;
  const [expanded, setExpanded] = useState(false);

  const hasInlineMore =
    !!item.usage_notes ||
    !!item.notes ||
    (item.__companions && item.__companions.length > 0) ||
    (showGoals && item.goals.length > 0);

  return (
    <div
      className={`rounded-xl p-3 flex items-start gap-3 transition-all ${taken ? "" : skipped ? "" : "card-glass"}`}
      style={{
        background:
          taken
            ? "var(--olive-tint)"
            : skipped
              ? "var(--surface-alt)"
              : undefined,
        border:
          taken
            ? "1px solid rgba(123, 139, 90, 0.25)"
            : skipped
              ? "1px solid var(--border)"
              : undefined,
        opacity: taken ? 0.85 : skipped ? 0.55 : 1,
      }}
    >
      {interactive ? (
        <button
          onClick={() => onToggle?.(item.id)}
          className="mt-0.5 shrink-0 h-6 w-6 rounded-full flex items-center justify-center transition-all"
          style={{
            background: taken ? "var(--olive)" : "transparent",
            border: taken
              ? "1px solid var(--olive)"
              : "1.5px solid var(--border-strong)",
            boxShadow: taken
              ? "0 2px 6px rgba(74, 82, 48, 0.3)"
              : undefined,
          }}
          aria-label={taken ? "Mark as not taken" : "Mark as taken"}
        >
          {taken && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FBFAF6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
          <div className="min-w-0 flex-1">
            <Link
              href={`/items/${item.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[14px] leading-snug truncate block hover:underline"
              style={{
                fontWeight: 500,
                textDecoration: taken ? "line-through" : undefined,
                textDecorationColor: "var(--muted)",
              }}
            >
              {item.name}
            </Link>
            <div
              className="text-[12px] truncate"
              style={{ color: "var(--muted)" }}
            >
              {[item.dose, item.brand].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            {compact && item.__companions && item.__companions.length > 0 && (
              <span
                className="text-[10px] px-1.5 py-[1px] rounded-full chip-olive"
                title={`${item.__companions.length} companion${item.__companions.length === 1 ? "" : "s"}`}
              >
                +{item.__companions.length}
              </span>
            )}
            {!compact && <CategoryBadge category={item.category} size="xs" />}
            {compact && hasInlineMore && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
                className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center"
                style={{ color: "var(--muted)" }}
                aria-label={expanded ? "Collapse" : "Expand"}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: expanded ? "rotate(180deg)" : "none",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Skip chip stays visible always */}
        {skipped && skipReason && (
          <div
            className="text-[11px] mt-1"
            style={{ color: "var(--muted)", fontStyle: "italic" }}
          >
            Skipped: {skipReason}
          </div>
        )}

        {/* Skip-with-reason inline button (only when not taken/skipped) */}
        {compact && interactive && !taken && !skipped && onSkip && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSkip(item);
            }}
            className="text-[10px] mt-1"
            style={{ color: "var(--muted)", opacity: 0.7 }}
          >
            skip
          </button>
        )}

        {/* COMPACT expanded section */}
        {compact && expanded && (
          <div
            className="mt-3 pt-3 flex flex-col gap-2"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            {item.usage_notes && (
              <div
                className="text-[12px] leading-relaxed whitespace-pre-line"
                style={{ color: "var(--foreground)", opacity: 0.85 }}
              >
                {item.usage_notes}
              </div>
            )}
            {item.notes && !item.usage_notes && (
              <div
                className="text-[12px]"
                style={{ color: "var(--muted)" }}
              >
                {item.notes}
              </div>
            )}
            {item.__companions && item.__companions.length > 0 && (
              <div className="flex flex-col gap-1">
                {item.__companions.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-baseline gap-2 text-[12px]"
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
            {!taken && !skipped && interactive && onSkip && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSkip(item);
                }}
                className="text-[11px] self-start"
                style={{ color: "var(--muted)", textDecoration: "underline" }}
              >
                Skip with reason
              </button>
            )}
          </div>
        )}

        {/* NON-COMPACT: full inline metadata (Stack, Item Detail) */}
        {!compact && (
          <>
            {item.usage_notes && !skipped && (
              <div
                className="text-[12px] mt-1.5 leading-relaxed whitespace-pre-line"
                style={{ color: "var(--foreground)", opacity: 0.85 }}
              >
                {item.usage_notes}
              </div>
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
          </>
        )}
      </div>
    </div>
  );
}
