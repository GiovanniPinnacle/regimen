"use client";

// ItemQuickActions — bottom sheet of actions for an item card.
// Triggered by the "···" button on ItemCard. Saves a trip to /items/[id]
// for the most common actions: skip, swap, mark depleted, edit, remove.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Item } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";
import { showToast } from "@/lib/toast";
import Sheet from "@/components/ui/Sheet";
import {
  snoozeItem,
  clearSnooze,
  formatExpiry,
  SNOOZE_OPTIONS,
} from "@/lib/snooze";

type Props = {
  item: Item | null;
  open: boolean;
  onClose: () => void;
  /** Called when user picks Skip — parent should open SkipReasonSheet. */
  onSkip?: (item: Item) => void;
  /** Called when user picks Swap — parent should open SwapSheet. */
  onSwap?: (item: Item) => void;
  /** Called after a state-changing action saves so parent can refresh. */
  onChanged?: () => void;
};

export default function ItemQuickActions({
  item,
  open,
  onClose,
  onSkip,
  onSwap,
  onChanged,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!item) return null;
  const isFood = item.item_type === "food";

  /** Centralized "items changed" notifier — fires the cross-page event
   *  AND calls the parent onChanged callback. Drop-in replacement for
   *  scattered onChanged?.() calls so every mutation reliably refreshes
   *  every list page. (Earlier version had a self-call that caused
   *  infinite recursion + a tab crash on every snooze/retire/deplete —
   *  Apr 2026 regression.) */
  function notifyItemsChanged() {
    onChanged?.();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("regimen:items-changed"));
    }
  }

  function snooze(minutes: number) {
    if (!item) return;
    const until = snoozeItem(item.id, minutes);
    onClose();
    showToast(`${item.name} snoozed until ${formatExpiry(until)}`, {
      duration: 4000,
      undo: () => {
        clearSnooze(item.id);
        notifyItemsChanged();
      },
    });
    notifyItemsChanged();
  }

  async function markDepleted() {
    if (!item) return;
    setBusy(true);
    const client = createClient();
    const { error } = await client
      .from("items")
      .update({ purchase_state: "needed", owned: false })
      .eq("id", item.id);
    setBusy(false);
    onClose();
    if (error) {
      showToast("Couldn't update", { tone: "error" });
      return;
    }
    showToast(`${item.name} added to your shopping list`, {
      tone: "warn",
      action: {
        label: "Shop",
        onClick: () => router.push("/purchases"),
      },
    });
    notifyItemsChanged();
  }

  async function retireFromProtocol() {
    if (!item) return;
    setBusy(true);
    const client = createClient();
    const { error } = await client
      .from("items")
      .update({ status: "retired" })
      .eq("id", item.id);
    setBusy(false);
    onClose();
    if (error) {
      showToast("Couldn't remove", { tone: "error" });
      return;
    }
    showToast(`${item.name} removed from your stack`, {
      undo: async () => {
        const c = createClient();
        await c.from("items").update({ status: "active" }).eq("id", item.id);
        notifyItemsChanged();
      },
    });
    notifyItemsChanged();
  }

  return (
    <Sheet open={open} onClose={onClose} title={item.name} description={
      [item.dose, item.brand].filter(Boolean).join(" · ") || undefined
    }>
      <div className="-mx-5 flex flex-col divide-y divide-[var(--border)] border-y border-[var(--border)]">
        {onSkip && (
          <ActionRow
            icon="ban"
            label="Skip today"
            detail="Pick a reason. You can undo"
            onClick={() => {
              onClose();
              onSkip(item);
            }}
            disabled={busy}
          />
        )}
        {isFood && onSwap && (
          <ActionRow
            icon="refresh"
            label="Log a swap"
            detail="What you had instead"
            onClick={() => {
              onClose();
              onSwap(item);
            }}
            disabled={busy}
          />
        )}
        <div className="px-5 py-3">
          <div className="mb-2 flex items-center gap-2 text-footnote text-[var(--muted)]">
            <Icon name="clock" size={14} strokeWidth={1.8} />
            Snooze this item
          </div>
          <div className="grid grid-cols-3 gap-2">
            {SNOOZE_OPTIONS.map((o) => (
              <button
                key={o.minutes}
                type="button"
                onClick={() => snooze(o.minutes)}
                disabled={busy}
                className="min-h-[44px] rounded-[12px] border border-[var(--border)] bg-[var(--surface-alt)] px-2 text-callout font-medium active:scale-[0.98]"
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <ActionRow
          icon="info"
          label="Details"
          detail="History, research, how to take it"
          href={`/items/${item.id}`}
          onClick={onClose}
          disabled={busy}
        />
        <ActionRow
          icon="edit"
          label="Edit"
          detail="Dose, brand, timing, notes"
          href={`/items/${item.id}/edit`}
          onClick={onClose}
          disabled={busy}
        />
        <ActionRow
          icon="shopping-bag"
          label="Running low"
          detail="Add to your shopping list"
          onClick={markDepleted}
          disabled={busy}
        />
        <ActionRow
          icon="trash"
          label="Remove from stack"
          detail="Stops showing on Today. You can bring it back"
          tone="error"
          onClick={retireFromProtocol}
          disabled={busy}
        />
      </div>
    </Sheet>
  );
}

function ActionRow({
  icon,
  label,
  detail,
  onClick,
  href,
  disabled,
  tone = "default",
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  detail?: string;
  onClick: () => void;
  href?: string;
  disabled?: boolean;
  tone?: "default" | "error";
}) {
  const inner = (
    <>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
          tone === "error"
            ? "bg-[var(--error-tint)] text-[var(--error)]"
            : "bg-[var(--surface-alt)] text-[var(--foreground-soft)]"
        }`}
      >
        <Icon name={icon} size={17} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span
          className={`block truncate text-body font-medium ${
            tone === "error" ? "text-[var(--error)]" : ""
          }`}
        >
          {label}
        </span>
        {detail && (
          <span className="block truncate text-footnote text-[var(--muted)]">
            {detail}
          </span>
        )}
      </span>
      {href && (
        <Icon
          name="chevron-right"
          size={16}
          strokeWidth={2}
          className="shrink-0 text-[var(--muted)]"
        />
      )}
    </>
  );
  const className =
    "flex min-h-[56px] w-full items-center gap-3 px-5 py-2 text-left active:bg-[var(--surface-alt)] transition-colors";
  if (href) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {inner}
    </button>
  );
}
