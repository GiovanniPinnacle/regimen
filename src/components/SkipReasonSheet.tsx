"use client";

import { useState } from "react";
import { logSkip } from "@/lib/storage";
import type { Item } from "@/lib/types";

const PREFILL_REASONS = [
  "Forgot",
  "Out of stock",
  "Don't have it yet",
  "Didn't want to",
  "Felt off — paused",
  "Stomach issue",
  "Schedule got crushed",
  "Save for tomorrow",
];

export default function SkipReasonSheet({
  item,
  date,
  open,
  onClose,
  onSkipped,
}: {
  item: Item | null;
  date: string;
  open: boolean;
  onClose: () => void;
  onSkipped: () => void;
}) {
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open || !item) return null;

  async function handleSelect(reason: string) {
    if (!item) return;
    setBusy(true);
    await logSkip(date, item.id, reason);
    setBusy(false);
    setCustom("");
    onSkipped();
    onClose();
  }

  async function handleCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!custom.trim() || !item) return;
    await handleSelect(custom.trim());
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
        className="w-full max-w-md rounded-t-3xl p-5 pb-8 glass-strong"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 1.5rem)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between gap-2 mb-4">
          <div>
            <div
              className="text-[11px] uppercase tracking-wider"
              style={{ color: "var(--muted)", fontWeight: 500 }}
            >
              Why skip?
            </div>
            <div
              className="text-[16px] mt-1"
              style={{ fontWeight: 500 }}
            >
              {item.name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[20px] leading-none px-2"
            style={{ color: "var(--muted)" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {PREFILL_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => handleSelect(r)}
              disabled={busy}
              className="text-[12px] px-3 py-1.5 rounded-full border-hair"
              style={{
                color: "var(--muted)",
                opacity: busy ? 0.5 : 1,
              }}
            >
              {r}
            </button>
          ))}
        </div>

        <form onSubmit={handleCustom} className="flex gap-2">
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Or write a reason…"
            className="flex-1 border-hair rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-hair-strong"
            style={{
              background: "var(--background)",
              color: "var(--foreground)",
            }}
          />
          <button
            type="submit"
            disabled={busy || !custom.trim()}
            className="px-3 py-2 rounded-lg text-[13px]"
            style={{
              background: "var(--foreground)",
              color: "var(--background)",
              fontWeight: 500,
              opacity: busy || !custom.trim() ? 0.5 : 1,
            }}
          >
            Skip
          </button>
        </form>

        <div
          className="text-[11px] mt-4 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Why this matters: skip patterns reveal what's actually working —
          if you keep "forgetting" something at lunch, the timing's wrong.
          If you keep being "out of stock", days_supply is mis-set.
        </div>
      </div>
    </div>
  );
}
