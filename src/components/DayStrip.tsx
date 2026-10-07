"use client";

// DayStrip — horizontal scrolling slot navigator. Cleaned up: each
// pill now shows a TIME RANGE in addition to the slot name + count,
// so the user reads their day as a timeline at a glance. The current
// slot's pill gets a raised surface + strong neutral border so "you are
// here" is unmissable; the selected pill is inverted white. Past slots that still
// have unchecked items show a subtle warn dot. Done slots show a
// checkmark in place of the count.

import { useEffect, useRef } from "react";
import type { TimingSlot } from "@/lib/types";
import { TIMING_LABELS } from "@/lib/constants";
import Icon from "@/components/Icon";

export type SlotStat = {
  slot: TimingSlot;
  total: number;
  taken: number;
  skipped: number;
  /** True when current time has already passed this slot's window. */
  past: boolean;
  /** True when this is the slot matching the current hour. */
  current: boolean;
  /** True for slots that don't track taken/skipped (e.g. Situational). */
  noCheckoff?: boolean;
};

type Props = {
  stats: SlotStat[];
  totalTaken: number;
  totalAll: number;
  active: TimingSlot | "all";
  onChange: (slot: TimingSlot | "all") => void;
};

// Strip labels — same words as the slot headers below the strip.
export const SLOT_SHORT: Record<TimingSlot, string> = {
  pre_breakfast: "Pre-breakfast",
  breakfast: "Breakfast",
  pre_workout: "Pre-workout",
  lunch: "Lunch",
  dinner: "Dinner",
  pre_bed: "Pre-bed",
  ongoing: "All day",
  situational: "As needed",
};

// Time ranges that match slotIsPast() / slotForHour() in /today/page.tsx.
// These are intentional, not configurable per user — the slots are
// anchored to a typical biohacker daily rhythm. Exported so the slot
// section header on /today can show the same time range without
// duplicating the constant.
export const SLOT_TIME: Record<TimingSlot, string> = {
  pre_breakfast: "6–9a",
  breakfast: "9–11a",
  pre_workout: "11a–12p",
  lunch: "12–3p",
  dinner: "5–8p",
  pre_bed: "8–11p",
  ongoing: "all day",
  situational: "as needed",
};

export default function DayStrip({
  stats,
  totalTaken,
  totalAll,
  active,
  onChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll active pill into the center of the strip.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeEl = container.querySelector<HTMLElement>('[data-active="true"]');
    if (!activeEl) return;
    const cw = container.offsetWidth;
    const aw = activeEl.offsetWidth;
    const target = activeEl.offsetLeft - cw / 2 + aw / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [active]);

  const allDone = totalAll > 0 && totalTaken === totalAll;

  return (
    <div className="-mx-5 mb-3">
      <div
        ref={containerRef}
        className="flex gap-2 overflow-x-auto px-5 pt-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <Pill
          label="All"
          time="day"
          sub={allDone ? "done" : `${totalTaken}/${totalAll}`}
          active={active === "all"}
          done={allDone}
          onClick={() => onChange("all")}
        />
        {stats.map((s) => {
          const finished = s.taken + s.skipped;
          const done = !s.noCheckoff && s.total > 0 && finished === s.total;
          const empty = s.total === 0;
          const sub = empty
            ? "—"
            : s.noCheckoff
              ? `${s.total}`
              : done
                ? "done"
                : `${s.taken}/${s.total}`;
          return (
            <Pill
              key={s.slot}
              label={SLOT_SHORT[s.slot] ?? TIMING_LABELS[s.slot]}
              time={SLOT_TIME[s.slot] ?? ""}
              sub={sub}
              active={active === s.slot}
              now={s.current}
              past={s.past && !done && s.total > 0}
              done={done}
              dim={empty}
              onClick={() => onChange(s.slot)}
            />
          );
        })}
      </div>
    </div>
  );
}

function Pill({
  label,
  time,
  sub,
  active,
  now,
  past,
  done,
  dim,
  onClick,
}: {
  label: string;
  /** Time range like "9-11a", "all day", or "day" for the All pill. */
  time: string;
  sub: string;
  active: boolean;
  now?: boolean;
  past?: boolean;
  done?: boolean;
  dim?: boolean;
  onClick: () => void;
}) {
  // Selection is neutral (inverted white). Green only marks a finished
  // slot. "Now" gets a stronger outline so you can spot it while
  // looking at another slot.
  const shell = active
    ? "bg-[var(--primary)] text-[var(--primary-fg)] border-[var(--primary)]"
    : done
      ? "bg-[var(--success-tint)] border-transparent"
      : now
        ? "bg-[var(--surface)] border-[var(--border-strong)]"
        : "bg-transparent border-[var(--border)]";
  const soft = active ? "text-[var(--primary-fg)]/70" : "text-[var(--muted)]";
  const main = active
    ? "text-[var(--primary-fg)]"
    : done
      ? "text-[var(--success)]"
      : "text-[var(--foreground)]";

  return (
    <button
      type="button"
      data-active={active ? "true" : "false"}
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label}, ${time}, ${sub === "done" ? "done" : sub}${now ? ", now" : ""}${past ? ", items left" : ""}`}
      className={`relative flex min-h-[60px] min-w-[76px] shrink-0 flex-col items-center justify-center rounded-[16px] border px-3 py-2 text-center transition-colors ${shell} ${dim && !active ? "opacity-55" : ""}`}
    >
      <span className={`text-eyebrow uppercase ${soft}`}>
        {now && !active ? "Now" : time}
      </span>
      <span className={`mt-0.5 text-caption font-semibold leading-none ${main}`}>
        {label}
      </span>
      <span
        className={`mt-1 flex h-4 items-center text-footnote font-semibold leading-none tabular-nums ${main}`}
      >
        {sub === "done" ? <Icon name="check" size={15} strokeWidth={2.6} /> : sub}
      </span>
      {past && !active && (
        <span
          aria-hidden
          className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[var(--warn)]"
        />
      )}
    </button>
  );
}
