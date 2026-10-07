"use client";

// Skip with a reason. One tap on a chip skips; the parent does the
// (optimistic) write and shows an undo toast.

import { useState } from "react";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import type { Item } from "@/lib/types";

const REASONS = [
  "Forgot",
  "Ran out",
  "Don't have it yet",
  "Felt off",
  "Stomach upset",
  "Busy day",
  "Didn't want to",
  "Saving for tomorrow",
];

export default function SkipReasonSheet({
  item,
  open,
  onClose,
  onSelect,
}: {
  item: Item | null;
  open: boolean;
  onClose: () => void;
  /** Called with the chosen reason. The sheet closes itself. */
  onSelect: (item: Item, reason: string) => void;
}) {
  const [custom, setCustom] = useState("");

  function pick(reason: string) {
    if (!item) return;
    setCustom("");
    onClose();
    onSelect(item, reason);
  }

  return (
    <Sheet
      open={open && !!item}
      onClose={onClose}
      title={item ? `Skip ${item.name}?` : "Skip"}
      description="A reason helps spot patterns. Ran out? It goes on your shopping list."
    >
      <div className="grid grid-cols-2 gap-2">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => pick(r)}
            className="min-h-[44px] rounded-[12px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 text-left text-callout font-medium active:scale-[0.98]"
          >
            {r}
          </button>
        ))}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (custom.trim()) pick(custom.trim());
        }}
      >
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Something else…"
          aria-label="Other reason"
          className="min-h-[44px] min-w-0 flex-1 rounded-[12px] border border-[var(--border-input)] bg-[var(--background)] px-3 text-body text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--border-strong)]"
        />
        <Button type="submit" variant="primary" disabled={!custom.trim()}>
          Skip
        </Button>
      </form>
    </Sheet>
  );
}
