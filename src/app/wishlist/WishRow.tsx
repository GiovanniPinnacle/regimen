"use client";

// WishRow — compact row. Tap row → expand inline. Long-press → enter
// bulk-select mode. Buy / Add to stack / Got it / Remove live in the
// expanded view. Buy is the one gold (affiliate) moment on the screen.

import { useRef, useState } from "react";
import type { WishlistItem, WishlistPriority } from "@/lib/types";
import Icon from "@/components/Icon";
import CostStepper from "@/components/CostStepper";
import Button, { IconButton } from "@/components/ui/Button";
import Segmented from "@/components/ui/Segmented";
import { Eyebrow } from "@/components/ui/Section";
import { PRIORITY_META, PRIORITY_ORDER, fmtDollars } from "./shared";

function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.host.replace(/^www\./, "") + u.pathname.slice(0, 32);
  } catch {
    return url;
  }
}

export default function WishRow({
  item,
  expanded,
  selected,
  inSelectMode,
  onExpand,
  onSelect,
  onPromote,
  onRemove,
  onGotIt,
  onSetPriority,
  onSetCost,
}: {
  item: WishlistItem;
  expanded: boolean;
  selected: boolean;
  inSelectMode: boolean;
  onExpand: () => void;
  onSelect: () => void;
  onPromote: () => void;
  onRemove: () => void;
  onGotIt: () => void;
  onSetPriority: (p: WishlistPriority) => void;
  onSetCost: (n: number | null) => void;
}) {
  const meta = PRIORITY_META[item.priority];
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const [busyBuy, setBusyBuy] = useState(false);

  function startLongPress() {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      onSelect();
      // Subtle haptic if available — nice native feel on iOS Safari.
      try {
        if ("vibrate" in navigator) navigator.vibrate?.(20);
      } catch {}
    }, 380);
  }
  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handleClickRow() {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (inSelectMode) {
      onSelect();
      return;
    }
    onExpand();
  }

  async function handleBuy(e: React.MouseEvent) {
    e.stopPropagation();
    if (busyBuy) return;
    setBusyBuy(true);
    try {
      const res = await fetch("/api/affiliates/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: item.name,
          fallbackUrl: item.url ?? undefined,
          source: "wishlist",
        }),
      });
      const data = (await res.json()) as { redirectUrl?: string };
      if (data.redirectUrl) {
        window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
      } else if (item.url) {
        window.open(item.url, "_blank", "noopener,noreferrer");
      }
    } catch {
      if (item.url) {
        window.open(item.url, "_blank", "noopener,noreferrer");
      }
    } finally {
      setBusyBuy(false);
    }
  }

  return (
    <div
      onClick={handleClickRow}
      onPointerDown={startLongPress}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
      className={`cursor-pointer overflow-hidden rounded-[20px] border transition-colors ${
        selected
          ? "border-[var(--foreground-soft)] bg-[var(--surface-alt)]"
          : "border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]"
      }`}
    >
      <div className="flex min-h-[60px] items-center gap-3 py-2 pl-4 pr-2">
        {inSelectMode ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={`relative flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[7px] border before:absolute before:-inset-3 before:content-[''] ${
              selected
                ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                : "border-[var(--border-strong)] bg-transparent"
            }`}
            aria-label={selected ? `Deselect ${item.name}` : `Select ${item.name}`}
          >
            {selected && <Icon name="check" size={14} strokeWidth={3} />}
          </button>
        ) : (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: meta.dot }}
            role="img"
            aria-label={meta.long}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-callout font-semibold">{item.name}</div>
          {(item.category || item.notes) && !expanded && (
            <div className="mt-0.5 truncate text-caption text-[var(--muted)]">
              {item.category && <span>{item.category}</span>}
              {item.category && item.notes && <span> · </span>}
              {item.notes && <span>{item.notes}</span>}
            </div>
          )}
        </div>
        {item.est_cost != null && (
          <span className="shrink-0 text-footnote font-semibold tabular-nums text-[var(--foreground)]">
            {fmtDollars(item.est_cost)}
          </span>
        )}
        <IconButton
          icon={expanded ? "chevron-up" : "chevron-down"}
          label={expanded ? `Collapse ${item.name}` : `Expand ${item.name}`}
          tone="plain"
          size={36}
          iconSize={16}
          aria-expanded={expanded}
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
        />
      </div>

      {expanded && (
        <div
          className="flex cursor-default flex-col gap-4 border-t border-[var(--border)] px-4 pt-3 pb-4"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {item.notes && (
            <p className="text-footnote leading-relaxed text-[var(--foreground-soft)]">
              {item.notes}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <Eyebrow className="mb-1.5">Estimated cost</Eyebrow>
              <CostStepper
                value={item.est_cost ?? null}
                onChange={onSetCost}
                size="sm"
              />
            </div>
            <div className="min-w-0">
              <Eyebrow className="mb-1.5">Priority</Eyebrow>
              <Segmented
                variant="pill"
                size="sm"
                ariaLabel={`Priority for ${item.name}`}
                value={item.priority}
                onChange={onSetPriority}
                options={PRIORITY_ORDER.map((p) => ({
                  value: p,
                  label: p === "medium" ? "Med" : PRIORITY_META[p].label,
                }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="premium"
              icon="shopping-bag"
              loading={busyBuy}
              onClick={handleBuy}
            >
              {item.url ? "Buy" : "Find online"}
            </Button>
            <Button variant="secondary" icon="sparkle" onClick={onPromote}>
              Add to stack
            </Button>
          </div>

          <div className="-mt-2 grid grid-cols-2 gap-2">
            <Button variant="ghost" icon="check-circle" onClick={onGotIt}>
              Got it
            </Button>
            <Button
              variant="ghost"
              icon="trash"
              onClick={onRemove}
              className="!text-[var(--error)]"
            >
              Remove
            </Button>
          </div>

          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="-my-2 inline-flex min-h-[44px] items-center gap-1.5 self-start text-footnote text-[var(--muted)]"
              onClick={(e) => e.stopPropagation()}
            >
              <Icon name="external" size={13} strokeWidth={2} />
              <span className="truncate">{prettyUrl(item.url)}</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}
