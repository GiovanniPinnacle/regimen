"use client";

// StarterPack — one curated pack (from src/lib/onboarding/packs.ts) with
// a single "Add to Today" tap. Items go in ACTIVE with their timing slot,
// so the Today checklist fills immediately. Used by /onboard step 2 and
// by EmptyToday.

import { useState } from "react";
import Icon from "@/components/Icon";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import { showToast } from "@/lib/toast";
import { SLOT_LABELS, type StarterPack as Pack } from "@/lib/onboarding/packs";
import type { TimingSlot } from "@/lib/types";

export type AddedItem = {
  id: string;
  name: string;
  dose: string | null;
  item_type: string;
  timing_slot: TimingSlot;
};

export default function StarterPack({
  pack,
  onAdded,
  compact = false,
  primary = false,
}: {
  pack: Pack;
  onAdded?: (items: AddedItem[]) => void;
  /** Hide the per-item "why" lines. */
  compact?: boolean;
  /** Render the add button as the page's primary CTA. */
  primary?: boolean;
}) {
  const [state, setState] = useState<"idle" | "adding" | "added">("idle");
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    if (state !== "idle") return;
    setState("adding");
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack: pack.key }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        items?: AddedItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Couldn't add that pack.");
      const items = data.items ?? [];
      setState("added");
      window.dispatchEvent(new CustomEvent("regimen:items-changed"));
      if (items.length === 0) showToast("Already on your Today");
      onAdded?.(items);
    } catch (e) {
      setErr((e as Error).message);
      setState("idle");
    }
  }

  return (
    <Card padding="md">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
          <Icon name={pack.icon} size={20} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-body font-semibold">{pack.title}</h3>
          <p className="text-footnote text-[var(--muted)]">{pack.blurb}</p>
        </div>
      </div>

      <ul className="mt-3 divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {pack.items.map((it) => (
          <li key={it.name} className="flex items-start gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-callout font-medium">
                {it.name}
                {it.dose && (
                  <span className="font-normal text-[var(--muted)]">
                    {" "}
                    · {it.dose}
                  </span>
                )}
              </div>
              {!compact && (
                <div className="mt-0.5 text-caption text-[var(--muted)]">
                  {it.why}
                </div>
              )}
            </div>
            <span className="shrink-0 pt-0.5 text-caption text-[var(--muted)]">
              {SLOT_LABELS[it.timing_slot]}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-2">
        {state === "added" ? (
          <div className="flex h-11 items-center justify-center">
            <Chip tone="success" icon="check">
              On your Today
            </Chip>
          </div>
        ) : (
          <Button
            variant={primary ? "primary" : "secondary"}
            size={primary ? "lg" : "md"}
            fullWidth
            icon="plus"
            loading={state === "adding"}
            onClick={add}
          >
            Add {pack.items.length} to Today
          </Button>
        )}
        {err && (
          <p className="mt-2 text-caption text-[var(--error)]" role="alert">
            {err}
          </p>
        )}
      </div>
    </Card>
  );
}
