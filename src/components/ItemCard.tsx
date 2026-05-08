"use client";

import { useState } from "react";
import Link from "next/link";
import type { Item } from "@/lib/types";
import CategoryBadge from "./CategoryBadge";
import ReactionRow, { shouldShowReaction } from "./ReactionRow";
import ItemQuickActions from "./ItemQuickActions";
import SwipeDismiss from "./SwipeDismiss";
import TutorialLink from "./TutorialLink";
import { GOAL_LABELS, ITEM_TYPE_ICONS } from "@/lib/constants";
import {
  snoozeItem,
  clearSnooze,
  formatExpiry,
  SNOOZE_OPTIONS,
} from "@/lib/snooze";
import { showToast } from "@/lib/toast";

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
  /** Swipe-left to retire callback. When set, the card is wrapped in
   *  SwipeDismiss and a left-swipe past threshold fires this handler.
   *  Caller is responsible for the DB mutation + undo toast + reload. */
  onSwipeRetire?: () => void | Promise<void>;
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
  onSwipeRetire,
}: Props) {
  const interactive = typeof onToggle === "function";
  const typeIcon = ITEM_TYPE_ICONS[item.item_type] ?? "";
  const skipped = !taken && !!skipReason;
  const swapped = skipped && skipReason?.startsWith("Swapped:");
  const [expanded, setExpanded] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [snoozePickerOpen, setSnoozePickerOpen] = useState(false);
  const isFood = item.item_type === "food";

  function handleSnooze(minutes: number) {
    const until = snoozeItem(item.id, minutes);
    setSnoozePickerOpen(false);
    showToast(`${item.name} snoozed til ${formatExpiry(until)}`, {
      duration: 3500,
      undo: () => {
        clearSnooze(item.id);
        onChanged?.();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("regimen:items-changed"));
        }
      },
    });
    onChanged?.();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("regimen:items-changed"));
    }
  }

  const hasInlineMore =
    !!item.usage_notes ||
    !!item.notes ||
    (item.__companions && item.__companions.length > 0) ||
    (showGoals && item.goals.length > 0);

  const cardInner = (
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

        {/* Tutorial chip — visible inline whenever the item has a
            how-to link. Lets the user open the video in one tap
            without going to item detail. */}
        {compact && (item.media_url || item.how_to) && (
          <div className="mt-1.5">
            <TutorialLink
              mediaUrl={item.media_url}
              howTo={item.how_to}
              variant="chip"
            />
          </div>
        )}

        {/* Inline action links (compact, only when not yet acted on).
            Snooze opens a tiny inline picker rather than firing a
            default duration — most users want "1 hour" but power users
            want "til tomorrow." Both are 1-tap from this row. */}
        {compact && interactive && !taken && !skipped && (
          <div className="mt-1.5 relative">
            <div className="flex gap-1.5 flex-wrap">
              {isFood && onSwap && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSwap(item);
                  }}
                  className="text-[12px] px-2.5 py-1.5 rounded-md"
                  style={{
                    color: "var(--olive)",
                    background: "var(--surface-alt)",
                    fontWeight: 600,
                    minHeight: 32,
                  }}
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
                  className="text-[12px] px-2.5 py-1.5 rounded-md"
                  style={{
                    color: "var(--foreground-soft)",
                    background: "var(--surface-alt)",
                    fontWeight: 600,
                    minHeight: 32,
                  }}
                >
                  skip
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSnoozePickerOpen((v) => !v);
                }}
                aria-expanded={snoozePickerOpen}
                className="text-[12px] px-2.5 py-1.5 rounded-md flex items-center gap-1"
                style={{
                  color: "var(--foreground-soft)",
                  background: snoozePickerOpen
                    ? "var(--olive-tint)"
                    : "var(--surface-alt)",
                  fontWeight: 600,
                  minHeight: 32,
                }}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
                snooze
              </button>
            </div>
            {snoozePickerOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 right-0 top-full mt-1.5 z-10 rounded-xl flex flex-wrap gap-1 p-1"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.10)",
                }}
              >
                {SNOOZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.minutes}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSnooze(opt.minutes);
                    }}
                    className="flex-1 min-w-[70px] text-[12px] px-2 py-1.5 rounded-md"
                    style={{
                      color: "var(--foreground)",
                      background: "var(--surface-alt)",
                      fontWeight: 600,
                      minHeight: 32,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSnoozePickerOpen(false);
                  }}
                  className="text-[12px] px-2 py-1.5 rounded-md"
                  style={{
                    color: "var(--muted)",
                    minHeight: 32,
                  }}
                  aria-label="Close snooze picker"
                >
                  ×
                </button>
              </div>
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
  );

  // Wrap in swipe gesture when caller wants swipe-to-retire. The wrapper
  // only triggers on left-swipe past threshold; vertical scroll, taps,
  // and inner buttons all stay native.
  const card = onSwipeRetire ? (
    <SwipeDismiss onDismiss={() => void onSwipeRetire()}>
      {cardInner}
    </SwipeDismiss>
  ) : (
    cardInner
  );

  return (
    <>
      {card}
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
