"use client";

import { useState } from "react";
import { logSwap } from "@/lib/storage";
import type { Item } from "@/lib/types";

const QUICK_SWAPS = [
  "Skipped meal",
  "Restaurant — guess",
  "Coffee + protein bar",
  "Just bone broth",
  "Just black coffee",
];

export default function SwapSheet({
  item,
  date,
  open,
  onClose,
  onSwapped,
}: {
  item: Item | null;
  date: string;
  open: boolean;
  onClose: () => void;
  onSwapped: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open || !item) return null;

  async function save(value: string) {
    if (!item || !value.trim()) return;
    setBusy(true);
    await logSwap(date, item.id, value.trim());
    setBusy(false);
    setText("");
    onSwapped();
    onClose();
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
              Ate something else?
            </div>
            <div className="text-[16px] mt-1" style={{ fontWeight: 500 }}>
              Instead of: {item.name}
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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(text);
          }}
          className="flex flex-col gap-3"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What did you actually eat? (e.g., '6oz salmon + avocado + arugula')"
            rows={3}
            autoFocus
            className="w-full border-hair rounded-lg p-3 text-[14px] resize-none focus:outline-none focus:border-hair-strong"
            style={{
              background: "var(--background)",
              color: "var(--foreground)",
            }}
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="px-4 py-2.5 rounded-lg text-[14px]"
            style={{
              background: "var(--olive)",
              color: "#FBFAF6",
              fontWeight: 500,
              opacity: busy || !text.trim() ? 0.5 : 1,
            }}
          >
            {busy ? "Saving…" : "Log swap"}
          </button>
        </form>

        <div className="mt-4">
          <div
            className="text-[11px] mb-2"
            style={{ color: "var(--muted)" }}
          >
            Quick options
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_SWAPS.map((q) => (
              <button
                key={q}
                onClick={() => save(q)}
                disabled={busy}
                className="text-[12px] px-3 py-1.5 rounded-full border-hair"
                style={{
                  color: "var(--muted)",
                  opacity: busy ? 0.5 : 1,
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div
          className="text-[11px] mt-4 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Why this matters: Claude tracks what you actually eat, not what was suggested. If you keep swapping eggs for X, the pattern surfaces in /refine.
        </div>
      </div>
    </div>
  );
}
