"use client";

// DayStrip + the checklist. One slot at a time by default (the slot for
// the current hour), or every slot via "All". Within a slot: open items,
// then a collapsed "Done (N)" group. Checked rows linger briefly so the
// check animation reads before the row moves into Done.

import { useCallback, useEffect, useRef, useState } from "react";
import DayStrip, {
  SLOT_SHORT,
  SLOT_TIME,
  type SlotStat,
} from "@/components/DayStrip";
import Icon from "@/components/Icon";
import { TIMING_LABELS, TIMING_ORDER } from "@/lib/constants";
import { clearSnooze, snoozeItem } from "@/lib/snooze";
import { showToast } from "@/lib/toast";
import type { ItemAdherence } from "@/lib/series";
import type { Item, TimingSlot } from "@/lib/types";
import ChecklistRow from "./ChecklistRow";
import {
  isCheckoffSlot,
  slotForHour,
  type Grouped,
} from "./model";
import type { LogState } from "./useTodayData";

const LINGER_MS = 650;

type Handlers = {
  onToggle: (item: Item) => void;
  onMore: (item: Item) => void;
  onMarkAll: (ids: string[]) => Promise<boolean>;
  onUnmarkAll: (ids: string[]) => Promise<boolean>;
  onAdd: (slot: TimingSlot) => void;
};

type Shared = Handlers & {
  grouped: Grouped;
  logs: Record<string, LogState>;
  adherence: Map<string, ItemAdherence>;
  snoozed: Set<string>;
  lingering: Set<string>;
  highlightId: string | null;
};

function SlotSection({
  slot,
  showHeader = true,
  hour,
  ...s
}: Shared & { slot: TimingSlot; showHeader?: boolean; hour: number }) {
  const [doneOpen, setDoneOpen] = useState(false);
  const list = s.grouped[slot] ?? [];
  const checkoff = isCheckoffSlot(slot);
  const log = (i: Item) => s.logs[i.id];
  const handled = (i: Item) => !!log(i)?.taken || !!log(i)?.skipped_reason;
  const todo = checkoff
    ? list.filter(
        (i) => s.lingering.has(i.id) || (!handled(i) && !s.snoozed.has(i.id)),
      )
    : list;
  const done = checkoff
    ? list.filter((i) => handled(i) && !s.lingering.has(i.id))
    : [];
  const snoozedHere = checkoff
    ? list.filter((i) => !handled(i) && s.snoozed.has(i.id))
    : [];
  const takenN = list.filter((i) => log(i)?.taken).length;
  const isNow = slotForHour(hour) === slot;
  const openIds = todo.filter((i) => !handled(i)).map((i) => i.id);

  // Reveal the Done group when the highlighted item lives there.
  const highlightInDone =
    !!s.highlightId && done.some((i) => i.id === s.highlightId);

  const name = SLOT_SHORT[slot] ?? TIMING_LABELS[slot];

  if (list.length === 0) {
    return (
      <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-callout text-[var(--muted)]">
        Nothing in {name}.
      </div>
    );
  }

  const row = (item: Item, interactive = checkoff) => (
    <ChecklistRow
      key={item.id}
      item={item}
      log={s.logs[item.id]}
      adherence={s.adherence.get(item.id)}
      interactive={interactive}
      highlight={s.highlightId === item.id}
      onToggle={s.onToggle}
      onMore={s.onMore}
    />
  );

  return (
    <section aria-label={name}>
      {showHeader && (
        <div className="mb-2 flex min-h-[44px] items-end justify-between gap-3 px-1">
          <div className="min-w-0">
            <div className="text-eyebrow uppercase text-[var(--muted)]">
              {SLOT_TIME[slot]}
              {isNow && checkoff && (
                <span className="text-[var(--foreground)]"> · Now</span>
              )}
            </div>
            <h2 className="text-title-3">
              {name}
              {checkoff && (
                <span className="ml-2 text-footnote font-medium text-[var(--muted)] tabular-nums">
                  {takenN} of {list.length}
                </span>
              )}
            </h2>
          </div>
          {checkoff && openIds.length > 0 && (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  for (const id of openIds) snoozeItem(id, 60);
                  showToast(
                    `${name} snoozed for 1 hour`,
                    {
                      duration: 4000,
                      undo: () => {
                        for (const id of openIds) clearSnooze(id);
                      },
                    },
                  );
                }}
                aria-label={`Snooze ${name} for 1 hour`}
                className="flex min-h-[44px] items-center gap-1 rounded-full px-2.5 text-footnote font-medium text-[var(--foreground-soft)] active:bg-[var(--surface)]"
              >
                <Icon name="clock" size={14} strokeWidth={1.9} />
                Snooze 1h
              </button>
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)]">
        <div className="divide-y divide-[var(--border)]">
          {todo.map((i) => row(i))}
        </div>

        {checkoff && todo.length === 0 && done.length > 0 && (
          <div className="flex min-h-[56px] items-center gap-3 px-4 text-callout text-[var(--foreground-soft)]">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--success-tint)] text-[var(--success)]">
              <Icon name="check" size={15} strokeWidth={2.6} />
            </span>
            {name} is done
          </div>
        )}

        {snoozedHere.length > 0 && (
          <div className="flex min-h-[48px] items-center justify-between gap-2 border-t border-[var(--border)] pr-2 pl-4 text-footnote text-[var(--muted)]">
            <span className="flex items-center gap-1.5">
              <Icon name="clock" size={14} strokeWidth={1.8} />
              {snoozedHere.length} snoozed
            </span>
            <button
              type="button"
              onClick={() => snoozedHere.forEach((i) => clearSnooze(i.id))}
              className="min-h-[44px] rounded-full px-3 font-medium text-[var(--foreground-soft)]"
            >
              Show now
            </button>
          </div>
        )}

        {done.length > 0 && (
          <div className="border-t border-[var(--border)]">
            <button
              type="button"
              onClick={() => setDoneOpen((v) => !v)}
              aria-expanded={doneOpen || highlightInDone}
              className="flex min-h-[48px] w-full items-center justify-between px-4 text-footnote font-medium text-[var(--muted)]"
            >
              <span className="flex items-center gap-2">
                <Icon
                  name="check"
                  size={14}
                  strokeWidth={2.4}
                  className="text-[var(--success)]"
                />
                Done ({done.length})
              </span>
              <Icon
                name="chevron-down"
                size={16}
                strokeWidth={2}
                className={`transition-transform ${doneOpen || highlightInDone ? "rotate-180" : ""}`}
              />
            </button>
            {(doneOpen || highlightInDone) && (
              <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
                {done.map((i) => row(i))}
              </div>
            )}
          </div>
        )}

        <div className="flex border-t border-[var(--border)]">
          {checkoff && openIds.length > 1 && (
            <button
              type="button"
              onClick={async () => {
                const ids = openIds;
                const ok = await s.onMarkAll(ids);
                if (!ok) return;
                showToast(
                  `${ids.length} marked done in ${name}`,
                  {
                    tone: "success",
                    undo: async () => {
                      await s.onUnmarkAll(ids);
                    },
                  },
                );
              }}
              className="flex min-h-[48px] flex-1 items-center gap-2 border-r border-[var(--border)] px-4 text-footnote font-medium text-[var(--foreground-soft)] active:bg-[var(--surface-alt)]"
            >
              <Icon name="check-circle" size={16} strokeWidth={1.9} />
              Mark all {openIds.length} done
            </button>
          )}
          <button
            type="button"
            onClick={() => s.onAdd(slot)}
            className="flex min-h-[48px] flex-1 items-center gap-2 px-4 text-footnote font-medium text-[var(--muted)] active:bg-[var(--surface-alt)]"
          >
            <Icon name="plus" size={15} strokeWidth={2} />
            {checkoff && openIds.length > 1
              ? "Add item"
              : `Add to ${name}`}
          </button>
        </div>
      </div>
    </section>
  );
}

export default function TodayChecklist({
  activeSlot,
  onChangeSlot,
  slotStats,
  totalTaken,
  totalAll,
  ...shared
}: Omit<Shared, "lingering"> & {
  activeSlot: TimingSlot | "all";
  onChangeSlot: (slot: TimingSlot | "all") => void;
  slotStats: SlotStat[];
  totalTaken: number;
  totalAll: number;
}) {
  const [hour] = useState(() => new Date().getHours());
  const [lingering, setLingering] = useState<Set<string>>(new Set());
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach(clearTimeout);
  }, []);

  const { onToggle, logs } = shared;
  const toggle = useCallback(
    (item: Item) => {
      if (!logs[item.id]?.taken) {
        setLingering((s) => new Set(s).add(item.id));
        clearTimeout(timers.current[item.id]);
        timers.current[item.id] = setTimeout(() => {
          setLingering((s) => {
            const n = new Set(s);
            n.delete(item.id);
            return n;
          });
        }, LINGER_MS);
      }
      onToggle(item);
    },
    [onToggle, logs],
  );

  const props: Shared = { ...shared, onToggle: toggle, lingering };
  const slots = TIMING_ORDER.filter((s) => (shared.grouped[s]?.length ?? 0) > 0);

  return (
    <div id="today-checklist" className="mt-6">
      <DayStrip
        stats={slotStats}
        totalTaken={totalTaken}
        totalAll={totalAll}
        active={activeSlot}
        onChange={onChangeSlot}
      />
      <div
        className="flex flex-col gap-6"
        onTouchStart={(e) => {
          if (activeSlot === "all") return;
          const t = e.touches[0];
          touch.current = { x: t.clientX, y: t.clientY, t: e.timeStamp };
        }}
        onTouchEnd={(e) => {
          const start = touch.current;
          touch.current = null;
          if (activeSlot === "all" || !start) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - start.x;
          if (Math.abs(t.clientY - start.y) > 60 || Math.abs(dx) < 70) return;
          if (e.timeStamp - start.t > 700) return;
          const idx = slots.indexOf(activeSlot);
          if (idx === -1) return;
          if (dx < 0 && idx < slots.length - 1) onChangeSlot(slots[idx + 1]);
          else if (dx > 0 && idx > 0) onChangeSlot(slots[idx - 1]);
        }}
      >
        {activeSlot === "all" ? (
          slots.map((slot) => (
            <SlotSection key={slot} slot={slot} hour={hour} {...props} />
          ))
        ) : (
          <SlotSection slot={activeSlot} hour={hour} {...props} />
        )}
      </div>
    </div>
  );
}
