"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Item, PurchaseState } from "@/lib/types";

const LABEL: Record<PurchaseState, string> = {
  needed: "Needed",
  ordered: "Ordered",
  shipped: "Shipped",
  arrived: "Arrived",
  using: "Using",
  depleted: "Depleted",
};

// Forward transitions (what to show as the next-step button)
const NEXT: Record<PurchaseState, PurchaseState | null> = {
  needed: "ordered",
  ordered: "shipped",
  shipped: "arrived",
  arrived: "using",
  using: "depleted",
  depleted: "needed",
};

export default function PurchaseStateControl({
  item,
  compact = false,
}: {
  item: Item;
  compact?: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<PurchaseState | null>(
    (item.purchase_state as PurchaseState | null) ?? null,
  );
  const [busy, setBusy] = useState(false);

  async function setTo(next: PurchaseState) {
    setBusy(true);
    const client = createClient();
    const today = new Date().toISOString().slice(0, 10);
    const update: Record<string, unknown> = { purchase_state: next };
    if (next === "ordered" && !item.ordered_on) update.ordered_on = today;
    if (next === "arrived" && !item.arrived_on) update.arrived_on = today;
    if (next === "using") {
      update.owned = true;
      if (!item.arrived_on) update.arrived_on = today;
      update.reorder_alert_sent_at = null;
    }
    if (next === "needed") {
      update.owned = false;
      update.reorder_alert_sent_at = null;
    }
    if (next === "depleted") {
      update.owned = false;
    }
    const { error } = await client.from("items").update(update).eq("id", item.id);
    if (!error) setState(next);
    router.refresh();
    setBusy(false);
  }

  const all: PurchaseState[] = [
    "needed",
    "ordered",
    "shipped",
    "arrived",
    "using",
    "depleted",
  ];

  if (compact) {
    // Single primary button: advance to next state
    const next = state ? NEXT[state] : "needed";
    return (
      <button
        onClick={() => next && setTo(next)}
        disabled={busy || !next}
        className="px-3 py-1.5 rounded-lg text-[12px] border-hair"
        style={{
          color: "var(--muted)",
          fontWeight: 500,
          opacity: busy ? 0.5 : 1,
        }}
      >
        {busy ? "…" : next ? `→ ${LABEL[next]}` : "—"}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((s) => {
        const active = state === s;
        return (
          <button
            key={s}
            onClick={() => setTo(s)}
            disabled={busy}
            className="px-3 py-1.5 rounded-full text-[12px] border-hair"
            style={{
              background: active ? "var(--foreground)" : "var(--background)",
              color: active ? "var(--background)" : "var(--muted)",
              fontWeight: active ? 500 : 400,
              opacity: busy ? 0.5 : 1,
            }}
          >
            {LABEL[s]}
          </button>
        );
      })}
    </div>
  );
}
