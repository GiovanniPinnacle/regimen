"use client";

// QuickAddInline — a one-line inline add at the bottom of each /today
// slot section. Designed for fast small-item entry: garlic, avocado,
// olive oil, MCT, salt, lemon. The kind of toppings users normally
// wouldn't bother adding because the friction is too high.
//
// Flow:
//   1. User taps the "+ Add to breakfast" pill
//   2. Pill expands to a row with: name input + optional "Pair with"
//      select (defaults to first non-companion item in slot) + Save
//   3. On Save → POST /api/items/quick-add → parent calls onAdded
//   4. We default new items to companions of the largest item in the slot
//      so the user's UI doesn't fragment into 14 tiny cards. They can
//      uncheck the "Attach to" pill to make it standalone.

import { useState } from "react";
import Icon from "@/components/Icon";
import type { Item, TimingSlot } from "@/lib/types";

const COMMON_TOPPINGS = [
  "Avocado",
  "Olive oil",
  "Garlic",
  "MCT oil",
  "Cinnamon",
  "Sea salt",
  "Lemon",
  "Butter (grass-fed)",
  "Greek yogurt",
  "Ginger",
  "Cottage cheese",
  "Berries",
];

type Props = {
  slot: TimingSlot;
  slotLabel: string;
  /** Items already in this slot — first non-companion shown as the
   *  default "Pair with" parent. */
  itemsInSlot: Item[];
  onAdded?: () => void;
};

export default function QuickAddInline({
  slot,
  slotLabel,
  itemsInSlot,
  onAdded,
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Possible parents = active, non-companion items in this slot
  const parents = itemsInSlot.filter((i) => !i.companion_of);
  const defaultParent = parents[0] ?? null;
  const [parentId, setParentId] = useState<string | null>(
    defaultParent?.id ?? null,
  );

  async function handleSave(initialName?: string) {
    const finalName = (initialName ?? name).trim();
    if (!finalName || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/items/quick-add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalName,
          timing_slot: slot,
          parent_id: parentId ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Save failed");
      }
      setName("");
      setOpen(false);
      window.dispatchEvent(
        new CustomEvent("regimen:toast", {
          detail: {
            kind: "success",
            text: `Added ${finalName}${parentId ? ` to ${parents.find((p) => p.id === parentId)?.name ?? "meal"}` : ""}`,
          },
        }),
      );
      // Tell every page that lists items to refresh.
      window.dispatchEvent(new CustomEvent("regimen:items-changed"));
      onAdded?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[12px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mt-1.5 transition-all active:scale-[0.97]"
        style={{
          background: "var(--surface-alt)",
          color: "var(--muted)",
          fontWeight: 600,
        }}
      >
        <Icon name="plus" size={11} strokeWidth={2.4} />
        Quick-add to {slotLabel.toLowerCase()}
      </button>
    );
  }

  return (
    <div
      className="rounded-2xl p-3 mt-1.5"
      style={{
        background: "var(--surface-alt)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="shrink-0"
          style={{ color: "var(--accent)" }}
        >
          <Icon name="plus" size={13} strokeWidth={2.2} />
        </span>
        <span
          className="text-[11px] uppercase tracking-wider"
          style={{
            color: "var(--accent)",
            fontWeight: 700,
            letterSpacing: "0.06em",
          }}
        >
          Add to {slotLabel}
        </span>
        <button
          onClick={() => {
            setOpen(false);
            setName("");
          }}
          className="ml-auto text-[12px]"
          style={{ color: "var(--muted)" }}
        >
          Cancel
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          placeholder="e.g. avocado, olive oil, garlic"
          autoFocus
          className="flex-1 rounded-xl px-3 py-2 text-[13px] focus:outline-none"
          style={{
            background: "var(--background)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
          }}
        />
        <button
          onClick={() => handleSave()}
          disabled={!name.trim() || busy}
          className="px-3 py-2 rounded-xl text-[13px] flex items-center gap-1"
          style={{
            background: "var(--accent)",
            color: "#FBFAF6",
            fontWeight: 700,
            opacity: !name.trim() || busy ? 0.5 : 1,
          }}
        >
          {busy ? "…" : "Add"}
        </button>
      </div>

      {/* Parent select */}
      {parents.length > 0 && (
        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
          <span
            className="text-[11px]"
            style={{ color: "var(--muted)" }}
          >
            Attach to:
          </span>
          <button
            onClick={() => setParentId(null)}
            className="text-[11px] px-2.5 py-1 rounded-full"
            style={{
              background:
                parentId === null
                  ? "var(--foreground)"
                  : "var(--surface)",
              color:
                parentId === null
                  ? "var(--background)"
                  : "var(--foreground-soft)",
              fontWeight: 600,
            }}
          >
            Standalone
          </button>
          {parents.slice(0, 4).map((p) => (
            <button
              key={p.id}
              onClick={() => setParentId(p.id)}
              className="text-[11px] px-2.5 py-1 rounded-full truncate max-w-[140px]"
              style={{
                background:
                  parentId === p.id
                    ? "var(--accent)"
                    : "var(--surface)",
                color:
                  parentId === p.id ? "#FBFAF6" : "var(--foreground-soft)",
                fontWeight: 600,
              }}
              title={p.name}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Common toppings — one-tap shortcuts */}
      <div className="mt-2 flex flex-wrap gap-1">
        {COMMON_TOPPINGS.slice(0, 8).map((t) => (
          <button
            key={t}
            onClick={() => {
              setName(t);
              void handleSave(t);
            }}
            disabled={busy}
            className="text-[10.5px] px-2 py-1 rounded-full"
            style={{
              background: "var(--background)",
              color: "var(--muted)",
              border: "1px solid var(--border)",
              opacity: busy ? 0.5 : 1,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {err && (
        <div
          className="text-[11px] mt-2"
          style={{ color: "var(--error)" }}
        >
          {err}
        </div>
      )}
    </div>
  );
}
