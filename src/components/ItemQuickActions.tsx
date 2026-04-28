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

  if (!open || !item) return null;
  const isFood = item.item_type === "food";

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
    showToast(`${item.name} flagged for re-order`, {
      tone: "warn",
      action: {
        label: "Shop",
        onClick: () => router.push("/purchases"),
      },
    });
    onChanged?.();
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
    showToast(`${item.name} retired`, {
      undo: async () => {
        const c = createClient();
        await c.from("items").update({ status: "active" }).eq("id", item.id);
        onChanged?.();
      },
    });
    onChanged?.();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{
        background: "rgba(31, 26, 20, 0.5)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl glass-strong overflow-hidden"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 1rem)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-5 pt-5 pb-3 flex items-baseline justify-between"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <div
              className="text-[11px] uppercase tracking-wider"
              style={{
                color: "var(--muted)",
                fontWeight: 600,
                letterSpacing: "0.06em",
              }}
            >
              Quick actions
            </div>
            <div
              className="text-[16px] mt-0.5"
              style={{ fontWeight: 500 }}
            >
              {item.name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="leading-none px-1"
            style={{ color: "var(--muted)" }}
            aria-label="Close"
          >
            <Icon name="plus" size={16} className="rotate-45" />
          </button>
        </div>

        <div className="flex flex-col">
          {onSkip && (
            <ActionRow
              icon="ban"
              label="Skip with reason"
              detail="Capture why you didn't take it"
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
              detail="Photo or text — what you ate instead"
              onClick={() => {
                onClose();
                onSwap(item);
              }}
              disabled={busy}
            />
          )}

          <ActionRow
            icon="shopping-bag"
            label="Mark as depleted"
            detail="Adds to shopping list"
            onClick={markDepleted}
            disabled={busy}
          />

          <ActionRow
            icon="edit"
            label="Edit item"
            detail="Dose, brand, timing, notes"
            href={`/items/${item.id}/edit`}
            onClick={onClose}
            disabled={busy}
          />

          <ActionRow
            icon="trash"
            label="Retire from stack"
            detail="Stops appearing on Today; you can revive later"
            tone="error"
            onClick={retireFromProtocol}
            disabled={busy}
            isLast
          />
        </div>
      </div>
    </div>
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
  isLast,
}: {
  icon: Parameters<typeof Icon>[0]["name"];
  label: string;
  detail?: string;
  onClick: () => void;
  href?: string;
  disabled?: boolean;
  tone?: "default" | "error";
  isLast?: boolean;
}) {
  const color = tone === "error" ? "var(--error)" : "var(--foreground)";
  const inner = (
    <>
      <span
        className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
        style={{
          background:
            tone === "error" ? "rgba(176, 0, 32, 0.08)" : "var(--olive-tint)",
          color: tone === "error" ? "var(--error)" : "var(--olive)",
        }}
      >
        <Icon name={icon} size={17} strokeWidth={1.7} />
      </span>
      <div className="flex-1 min-w-0 text-left">
        <div
          className="text-[14px] leading-snug"
          style={{ fontWeight: 500, color }}
        >
          {label}
        </div>
        {detail && (
          <div
            className="text-[12px] mt-0.5 leading-snug"
            style={{ color: "var(--muted)" }}
          >
            {detail}
          </div>
        )}
      </div>
      <Icon
        name="chevron-right"
        size={14}
        className="shrink-0 opacity-40"
      />
    </>
  );
  const className =
    "px-5 py-3.5 flex items-center gap-3 w-full text-left transition-colors";
  const style = {
    borderBottom: isLast ? undefined : "1px solid var(--border)",
    opacity: disabled ? 0.5 : 1,
  };
  if (href) {
    return (
      <Link href={href} className={className} style={style} onClick={onClick}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={style}
    >
      {inner}
    </button>
  );
}
