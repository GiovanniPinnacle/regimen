"use client";

// Which slot the checklist shows, plus per-slot stats for the DayStrip.
// Defaults to the slot for the current hour (or the next one with open
// work), restores a same-day manual choice, and moves on to the next
// open slot when the one you're working through is finished.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SLOT_SHORT, type SlotStat } from "@/components/DayStrip";
import { TIMING_ORDER } from "@/lib/constants";
import { showToast } from "@/lib/toast";
import type { Item, TimingSlot } from "@/lib/types";
import {
  DAY_SLOTS,
  isCheckoffSlot,
  pickDefaultSlot,
  slotForHour,
  slotIsPast,
  type Grouped,
} from "./model";
import type { LogState } from "./useTodayData";

const ACTIVE_SLOT_KEY = "regimen.today.activeSlot.v3";
const ADVANCE_DELAY_MS = 900;

export function useTodaySlots({
  grouped,
  logs,
  snoozed,
  loading,
  today,
}: {
  grouped: Grouped;
  logs: Record<string, LogState>;
  snoozed: Set<string>;
  loading: boolean;
  today: string;
}) {
  const [active, setActive] = useState<TimingSlot | "all" | null>(null);
  const [hour] = useState(() => new Date().getHours());

  const isOpen = useCallback(
    (i: Item) =>
      !logs[i.id]?.taken && !logs[i.id]?.skipped_reason && !snoozed.has(i.id),
    [logs, snoozed],
  );

  // First slot choice, made once when data arrives (derived-state
  // pattern — no effect cascade).
  if (!loading && active === null) {
    let initial: TimingSlot | "all" | null = null;
    try {
      const raw = localStorage.getItem(ACTIVE_SLOT_KEY);
      const saved = raw
        ? (JSON.parse(raw) as { date: string; slot: TimingSlot | "all" })
        : null;
      if (
        saved?.date === today &&
        (saved.slot === "all" || (grouped[saved.slot]?.length ?? 0) > 0)
      ) {
        initial = saved.slot;
      }
    } catch {}
    setActive(initial ?? pickDefaultSlot(hour, grouped, isOpen));
  }

  const change = useCallback(
    (slot: TimingSlot | "all") => {
      setActive(slot);
      try {
        localStorage.setItem(
          ACTIVE_SLOT_KEY,
          JSON.stringify({ date: today, slot }),
        );
      } catch {}
    },
    [today],
  );

  // Auto-advance only on the transition "had open items → none".
  const prevOpen = useRef<{ slot: string; n: number } | null>(null);
  useEffect(() => {
    if (!active || active === "all" || !isCheckoffSlot(active)) {
      prevOpen.current = null;
      return;
    }
    const n = (grouped[active] ?? []).filter(isOpen).length;
    const prev = prevOpen.current;
    prevOpen.current = { slot: active, n };
    if (!prev || prev.slot !== active || prev.n === 0 || n > 0) return;
    const order = [...DAY_SLOTS, "ongoing"] as TimingSlot[];
    const idx = order.indexOf(active);
    const next = order
      .slice(idx + 1)
      .find((s) => (grouped[s] ?? []).some(isOpen));
    if (!next) return;
    const from = active;
    const t = setTimeout(() => {
      setActive(next);
      showToast(`${SLOT_SHORT[from]} done. Next up: ${SLOT_SHORT[next]}`);
    }, ADVANCE_DELAY_MS);
    return () => clearTimeout(t);
  }, [active, grouped, isOpen]);

  const stats: SlotStat[] = useMemo(() => {
    const current = slotForHour(hour);
    return TIMING_ORDER.filter((s) => (grouped[s] ?? []).length > 0).map(
      (slot) => {
        const list = grouped[slot];
        const checkoff = isCheckoffSlot(slot);
        return {
          slot,
          total: list.length,
          taken: checkoff ? list.filter((i) => logs[i.id]?.taken).length : 0,
          skipped: checkoff
            ? list.filter((i) => !logs[i.id]?.taken && logs[i.id]?.skipped_reason)
                .length
            : 0,
          past: checkoff && slotIsPast(slot, hour),
          current: checkoff && current === slot,
          noCheckoff: !checkoff,
        };
      },
    );
  }, [grouped, logs, hour]);

  return { active: active ?? "all", setActive: change, stats, isOpen };
}
