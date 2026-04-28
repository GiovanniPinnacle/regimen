"use client";

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
    <div className="-mx-4 mb-5">
      <div
        ref={containerRef}
        className="flex gap-1.5 px-4 overflow-x-auto pb-2"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <Pill
          label="All"
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
  sub,
  active,
  now,
  past,
  done,
  dim,
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  now?: boolean;
  past?: boolean;
  done?: boolean;
  dim?: boolean;
  onClick: () => void;
}) {
  // Cleaner palette — no double border-on-shadow, simpler active state.
  const bg = active
    ? "var(--olive)"
    : done
      ? "var(--olive-tint)"
      : "transparent";
  const border = active
    ? "1px solid var(--olive)"
    : done
      ? "1px solid transparent"
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
      className="shrink-0 px-3 py-1.5 rounded-2xl transition-all relative"
      style={{
        background: bg,
        border,
        boxShadow: active
          ? "0 4px 14px rgba(74, 82, 48, 0.18)"
          : undefined,
        minWidth: "70px",
        opacity: dim && !active ? 0.55 : 1,
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
          fontWeight: now && !active ? 600 : 500,
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div
        className="text-[14px] mt-0.5 leading-none tabular-nums"
        style={{ color: subColor, fontWeight: 600 }}
      >
        {sub}
      </div>
      {past && !active && (
        <span
          className="absolute top-1.5 right-1.5 h-1 w-1 rounded-full"
          style={{ background: "var(--warn)" }}
          aria-label="overdue"
        />
      )}
      {now && !active && (
        <span
          aria-hidden
          className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full"
          style={{
            width: "20px",
            height: "2px",
            background: "var(--olive)",
          }}
        />
      )}
    </button>
  );
}
