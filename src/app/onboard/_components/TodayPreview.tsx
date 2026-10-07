"use client";

// TodayPreview — a read-only miniature of the Today checklist, built from
// the user's real active items. Shown at the end of onboarding so the
// payoff ("this is my day, sorted") is visible before they leave setup.

import Card from "@/components/ui/Card";
import { SLOT_LABELS } from "@/lib/onboarding/packs";
import { TIMING_ORDER } from "@/lib/constants";
import type { TimingSlot } from "@/lib/types";

export type PreviewItem = {
  id: string;
  name: string;
  dose: string | null;
  timing_slot: TimingSlot;
};

const PER_SLOT = 3;

export default function TodayPreview({ items }: { items: PreviewItem[] }) {
  const groups = TIMING_ORDER.map((slot) => ({
    slot,
    items: items.filter((i) => i.timing_slot === slot),
  })).filter((g) => g.items.length > 0);

  if (groups.length === 0) {
    return (
      <Card padding="lg" className="text-center">
        <p className="text-callout text-[var(--foreground-soft)]">
          Your Today is empty for now. Add things anytime from the Today tab.
        </p>
      </Card>
    );
  }

  return (
    <Card padding="none" aria-label="Preview of your Today checklist">
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <span className="text-callout font-semibold">Today</span>
        <span className="text-caption tabular-nums text-[var(--muted)]">
          0 of {items.length} done
        </span>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {groups.map((g) => (
          <div key={g.slot} className="px-4 py-3">
            <div className="text-eyebrow uppercase text-[var(--muted)]">
              {SLOT_LABELS[g.slot]}
            </div>
            <ul className="mt-1.5 flex flex-col gap-2">
              {g.items.slice(0, PER_SLOT).map((it) => (
                <li key={it.id} className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] border-[var(--border-strong)]"
                  />
                  <span className="truncate text-callout">
                    {it.name}
                    {it.dose && (
                      <span className="text-[var(--muted)]"> · {it.dose}</span>
                    )}
                  </span>
                </li>
              ))}
              {g.items.length > PER_SLOT && (
                <li className="pl-[28px] text-caption text-[var(--muted)]">
                  +{g.items.length - PER_SLOT} more
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
