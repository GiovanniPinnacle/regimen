"use client";

import { useState } from "react";
import Link from "next/link";
import type { Item } from "@/lib/types";
import CategoryBadge from "./CategoryBadge";
import ReactionRow, { shouldShowReaction } from "./ReactionRow";
import ItemQuickActions from "./ItemQuickActions";
import Icon from "./Icon";
import { GOAL_LABELS, ITEM_TYPE_ICONS } from "@/lib/constants";

type Props = {
  item: Item;
  taken?: boolean;
  onToggle?: (id: string) => void;
  onSkip?: (item: Item) => void;
  onSwap?: (item: Item) => void;
  /** Called after a quick-action mutation so parent can refresh state. */
  onChanged?: () => void;
  skipReason?: string | null;
  showGoals?: boolean;
  showTrigger?: boolean;
  showTypeIcon?: boolean;
  /** Adherence fraction (0..1) over recent window — shows as small chip. */
  adherence?: number | null;
  /** Days of supply remaining — negative = depleted. Shows warning chip. */
  daysSupplyLeft?: number | null;
  /** Compact mode (Today): hide usage_notes, notes, goals; show companions
   * count chip; tap a chevron or the Details summary for inline expand. */
  compact?: boolean;
};

export default function ItemCard({
  item,
  taken,
  onToggle,
  onSkip,
  onSwap,
  onChanged,
  skipReason,
  showGoals = true,
  showTrigger = false,
  showTypeIcon = true,
  adherence = null,
  daysSupplyLeft = null,
  compact = false,
}: Props) {
  const interactive = typeof onToggle === "function";
  const typeIcon = ITEM_TYPE_ICONS[item.item_type] ?? "";
  const skipped = !taken && !!skipReason;
  const swapped = skipped && skipReason?.startsWith("Swapped:");
  const [expanded, setExpanded] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const isFood = item.item_type === "food";

  const hasInlineMore =
    !!item.usage_notes ||
    !!item.notes ||
    (item.__companions && item.__companions.length > 0) ||
    (showGoals && item.goals.length > 0);

  return (
    <>
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
            ? "1px solid var(--accent-glow)"
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
              ? "0 2px 6px var(--accent-glow)"
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
          <div className="shrink-0 flex items-center gap-1">
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
                className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center"
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
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActionsOpen(true);
              }}
              className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center"
              style={{ color: "var(--muted)" }}
              aria-label="More actions"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
          </div>
        </div>

        {/* Skip / Swap chip stays visible always */}
        {skipped && skipReason && (
          <div
            className="text-[11px] mt-1"
            style={{
              color: swapped ? "var(--olive)" : "var(--muted)",
              fontStyle: "italic",
            }}
          >
            {swapped
              ? `↔ ${skipReason.replace(/^Swapped:\s*/i, "")}`
              : `Skipped: ${skipReason}`}
          </div>
        )}

        {/* Inline companions — ALWAYS visible in compact mode so meals
         *  read as one card instead of fragmenting into eggs+avocado+
         *  garlic+oil. Shows "+ avocado, olive oil, garlic" as a single
         *  comma-list under the parent's dose line. Tap the chevron to
         *  expand and see each companion's dose/instruction. */}
        {compact &&
          item.__companions &&
          item.__companions.length > 0 &&
          !expanded && (
            <div
              className="text-[11.5px] mt-0.5 leading-snug truncate"
              style={{ color: "var(--muted)" }}
            >
              <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                +
              </span>{" "}
              {item.__companions.map((c) => c.name).join(", ")}
            </div>
          )}

        {/* Inline action links (compact, only when not yet acted on) */}
        {compact && interactive && !taken && !skipped && (
          <div className="flex gap-3 mt-1">
            {isFood && onSwap && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSwap(item);
                }}
                className="text-[10px]"
                style={{ color: "var(--olive)", opacity: 0.85 }}
              >
                ↔ swap
              </button>
            )}
            {onSkip && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSkip(item);
                }}
                className="text-[10px]"
                style={{ color: "var(--muted)", opacity: 0.7 }}
              >
                skip
              </button>
            )}
          </div>
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
            {!taken && !skipped && interactive && (
              <div className="flex gap-3 self-start">
                {isFood && onSwap && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSwap(item);
                    }}
                    className="text-[11px]"
                    style={{
                      color: "var(--olive)",
                      textDecoration: "underline",
                    }}
                  >
                    ↔ Swap (ate something else)
                  </button>
                )}
                {onSkip && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSkip(item);
                    }}
                    className="text-[11px]"
                    style={{ color: "var(--muted)", textDecoration: "underline" }}
                  >
                    Skip with reason
                  </button>
                )}
              </div>
            )}
            {shouldShowReaction(item) && <ReactionRow itemId={item.id} compact />}
          </div>
        )}

        {/* NON-COMPACT: full inline metadata (Stack, Item Detail) */}
        {!compact && (
          <>
            {(adherence != null || daysSupplyLeft != null) && (
              <div
                className="flex items-center gap-x-3 gap-y-1 mt-2 text-[11px] tabular-nums"
                style={{ color: "var(--muted)" }}
              >
                {adherence != null && (
                  <span
                    style={{
                      color:
                        adherence >= 0.8
                          ? "var(--olive)"
                          : adherence >= 0.5
                            ? "var(--warn)"
                            : "var(--error)",
                      fontWeight: 600,
                    }}
                  >
                    {Math.round(adherence * 100)}%
                    <span
                      style={{ color: "var(--muted)", fontWeight: 400 }}
                    >
                      {" "}adherence
                    </span>
                  </span>
                )}
                {daysSupplyLeft != null && daysSupplyLeft < 14 && (
                  <span
                    style={{
                      color:
                        daysSupplyLeft < 0
                          ? "var(--error)"
                          : daysSupplyLeft < 7
                            ? "var(--warn)"
                            : "var(--muted)",
                      fontWeight: daysSupplyLeft < 7 ? 600 : 500,
                    }}
                  >
                    {daysSupplyLeft < 0
                      ? "Depleted"
                      : daysSupplyLeft === 0
                        ? "Out today"
                        : `${daysSupplyLeft}d left`}
                  </span>
                )}
              </div>
            )}
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
            {shouldShowReaction(item) && (
              <ReactionRow itemId={item.id} compact={false} />
            )}
          </>
        )}
      </div>
    </div>
    <ItemQuickActions
      item={item}
      open={actionsOpen}
      onClose={() => setActionsOpen(false)}
      onSkip={onSkip}
      onSwap={onSwap}
      onChanged={onChanged}
    />
    </>
  );
}
