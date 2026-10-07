"use client";

// One checklist row. The whole row (≥60px) toggles done; the trailing
// ··· button (44px) opens the item's actions. Shows the item's type,
// dose/brand, companions, and a 14-day adherence sparkline + %.

import { memo } from "react";
import Icon from "@/components/Icon";
import Sparkline from "@/components/Sparkline";
import { ITEM_TYPE_ICON_NAME } from "@/lib/constants";
import type { Item } from "@/lib/types";
import type { ItemAdherence } from "@/lib/series";
import type { LogState } from "./useTodayData";

function CheckCircle({ done, skipped }: { done: boolean; skipped: boolean }) {
  return (
    <span
      aria-hidden
      className={[
        "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px]",
        "transition-[background-color,border-color,transform] duration-200 ease-[var(--ease-spring)]",
        done
          ? "scale-100 border-[var(--success)] bg-[var(--success)] text-[var(--success-fg)]"
          : skipped
            ? "border-[var(--border-strong)] border-dashed text-[var(--muted)]"
            : "border-[var(--border-strong)] text-transparent group-active:scale-90",
      ].join(" ")}
    >
      {skipped && !done ? (
        <Icon name="minus" size={14} strokeWidth={2.4} />
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={done ? 0 : 1}
            style={{
              transition: "stroke-dashoffset 260ms var(--ease-out) 60ms",
            }}
          />
        </svg>
      )}
    </span>
  );
}

function ChecklistRow({
  item,
  log,
  adherence,
  interactive = true,
  highlight,
  onToggle,
  onMore,
}: {
  item: Item;
  log?: LogState;
  adherence?: ItemAdherence;
  /** False for as-needed rows: no check, row opens actions instead. */
  interactive?: boolean;
  highlight?: boolean;
  onToggle: (item: Item) => void;
  onMore: (item: Item) => void;
}) {
  const done = !!log?.taken;
  const skipReason = !done ? log?.skipped_reason : null;
  const skipped = !!skipReason;
  const swapped = skipReason?.startsWith("Swapped:");
  const companions = item.__companions ?? [];
  const sub = [item.dose, item.brand].filter(Boolean).join(" · ");
  const rate = adherence?.rate;
  const typeIcon = ITEM_TYPE_ICON_NAME[item.item_type];

  return (
    <div
      id={`today-item-${item.id}`}
      className={[
        "group relative flex items-stretch transition-colors duration-700",
        highlight ? "bg-[var(--surface-alt)]" : "",
      ].join(" ")}
    >
      <button
        type="button"
        role={interactive ? "checkbox" : undefined}
        aria-checked={interactive ? done : undefined}
        aria-label={
          interactive
            ? `${item.name}${sub ? `, ${sub}` : ""}`
            : `${item.name}, as needed. Options`
        }
        onClick={() => (interactive ? onToggle(item) : onMore(item))}
        className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-2.5 pr-1 pl-4 text-left whitespace-normal active:bg-[var(--surface-alt)] transition-colors"
      >
        {interactive ? (
          <CheckCircle done={done} skipped={skipped} />
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
            <Icon name={typeIcon} size={15} strokeWidth={1.8} />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span
            className={[
              "line-clamp-2 text-body font-semibold transition-colors",
              done || skipped ? "text-[var(--muted)]" : "",
            ].join(" ")}
          >
            {item.name}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-footnote text-[var(--muted)]">
            {interactive && (
              <Icon
                name={typeIcon}
                size={13}
                strokeWidth={1.8}
                className="shrink-0"
              />
            )}
            <span className="truncate">
              {skipped
                ? swapped
                  ? `Swapped for ${skipReason!.replace(/^Swapped:\s*/i, "")}`
                  : `Skipped · ${skipReason}`
                : sub ||
                  (item.item_type === "practice" ? "Habit" : "No dose set")}
            </span>
          </span>
          {companions.length > 0 && !skipped && (
            <span className="mt-0.5 block truncate text-footnote text-[var(--muted)]">
              + {companions.map((c) => c.name).join(", ")}
            </span>
          )}
        </span>
        {rate != null && adherence && (
          <span
            className="flex shrink-0 flex-col items-end gap-1"
            aria-label={`${Math.round(rate * 100)}% over the last 14 days`}
          >
            <span className="text-caption font-medium text-[var(--foreground-soft)] tabular-nums">
              {Math.round(rate * 100)}%
            </span>
            <Sparkline
              values={adherence.series}
              mode="bars"
              width={42}
              height={12}
              max={1}
              color="var(--foreground-soft)"
              emptyColor="var(--border)"
              ariaLabel="14-day history"
            />
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => onMore(item)}
        aria-label={`More for ${item.name}`}
        className="flex w-11 shrink-0 items-center justify-center text-[var(--muted)] active:bg-[var(--surface-alt)] transition-colors"
      >
        <Icon name="more" size={18} />
      </button>
    </div>
  );
}

export default memo(ChecklistRow);
