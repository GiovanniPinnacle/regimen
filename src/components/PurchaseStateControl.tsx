"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Item, PurchaseState } from "@/lib/types";
import { localDateISO } from "@/lib/series";
import Button from "@/components/ui/Button";
import { ChipButton } from "@/components/ui/Chip";

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
    const today = localDateISO();
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
    // Single button: advance to next state
    const next = state ? NEXT[state] : "needed";
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => next && setTo(next)}
        disabled={busy || !next}
        loading={busy}
        iconRight={next ? "arrow-right" : undefined}
        aria-label={next ? `Mark as ${LABEL[next]}` : undefined}
        className="relative before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']"
      >
        {next ? LABEL[next] : "Done"}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Purchase status">
      {all.map((s) => (
        <ChipButton
          key={s}
          selected={state === s}
          onClick={() => setTo(s)}
          disabled={busy}
          className={busy ? "opacity-50" : ""}
        >
          {LABEL[s]}
        </ChipButton>
      ))}
    </div>
  );
}
