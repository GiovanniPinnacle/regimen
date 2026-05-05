"use client";

// DayStrip — horizontal scrolling slot navigator. Cleaned up: each
// pill now shows a TIME RANGE in addition to the slot name + count,
// so the user reads their day as a timeline at a glance. The current
// slot's pill is larger and visually distinct (raised + accent
// border) so "you are here" is unmissable. Past slots that still
// have unchecked items show a subtle warn dot. Done slots show a
// checkmark in place of the count.

import { useEffect, useRef } from "react";
import type { TimingSlot } from "@/lib/types";
import { TIMING_LABELS } from "@/lib/constants";

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

// Compact labels for the horizontal strip — full labels are too wide.
const SLOT_SHORT: Record<TimingSlot, string> = {
  pre_breakfast: "Pre-AM",
  breakfast: "Breakfast",
  pre_workout: "Pre-WO",
  lunch: "Lunch",
  dinner: "Dinner",
  pre_bed: "Pre-bed",
  ongoing: "Ongoing",
  situational: "PRN",
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
    <div className="-mx-4 mb-4">
      <div
        ref={containerRef}
        className="flex gap-2 px-4 overflow-x-auto pb-3 pt-1"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <Pill
          label="All"
          time="day"
          sub={allDone ? "✓" : `${totalTaken}/${totalAll}`}
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
                ? "✓"
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
  // Active pill is bigger + raised. Now (current time) gets a left
  // accent stripe even when not active so the user can spot "where
  // they are" while looking at a different slot.
  const bg = active
    ? "var(--olive)"
    : done
      ? "var(--olive-tint)"
      : now
        ? "var(--surface)"
        : "transparent";
  const border = active
    ? "1px solid var(--olive)"
    : done
      ? "1px solid transparent"
      : now
        ? "1px solid var(--olive)"
        : "1px solid var(--border)";
  const subColor = active
    ? "#FBFAF6"
    : done
      ? "var(--olive)"
      : dim
        ? "var(--muted)"
        : "var(--foreground)";

  return (
    <button
      data-active={active ? "true" : "false"}
      onClick={onClick}
      className="shrink-0 rounded-2xl transition-all relative flex flex-col items-center justify-center text-center"
      style={{
        background: bg,
        border,
        boxShadow: active
          ? "0 6px 18px var(--accent-glow)"
          : now
            ? "0 2px 6px rgba(31, 26, 20, 0.06)"
            : undefined,
        minWidth: active ? 92 : 80,
        padding: active ? "10px 12px" : "8px 12px",
        opacity: dim && !active ? 0.55 : 1,
        transform: active ? "translateY(-1px)" : undefined,
      }}
      aria-pressed={active}
    >
      <div
        className="text-[10px] uppercase tracking-wider"
        style={{
          color: active
            ? "rgba(251, 250, 246, 0.78)"
            : now
              ? "var(--olive)"
              : "var(--muted)",
          fontWeight: 600,
          letterSpacing: "0.06em",
        }}
      >
        {time}
      </div>
      <div
        className="text-[12px] mt-0.5 leading-none"
        style={{
          color: active
            ? "#FBFAF6"
            : now
              ? "var(--olive)"
              : "var(--foreground-soft)",
          fontWeight: now || active ? 700 : 600,
        }}
      >
        {label}
      </div>
      <div
        className="text-[14px] mt-1 leading-none tabular-nums"
        style={{ color: subColor, fontWeight: 700 }}
      >
        {sub}
      </div>
      {past && !active && (
        <span
          className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--warn)" }}
          aria-label="overdue"
        />
      )}
    </button>
  );
}
