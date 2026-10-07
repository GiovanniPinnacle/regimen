"use client";

// /today — the daily checklist.
//
//   Header      date · "Today" · Coach sparkle
//   Hero        ring (taken / due) · streak · pace vs a usual day · Oura
//   Context     at most ONE card (safety > streak > protocol > Coach > setup)
//   Checklist   DayStrip + slot list, done items folded away
//   Log         water / meal / how I feel → universal capture
//
// Data: one load in useTodayData (no per-widget stack_log queries).

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import PageHeader from "@/components/ui/PageHeader";
import EmptyToday from "@/components/EmptyToday";
import { SkeletonItemList, SkeletonLine } from "@/components/Skeleton";
import { fireConfetti } from "@/lib/confetti";
import {
  addDaysISO,
  aggregateAdherence,
  dailyAdherence,
  daysBetween,
  isScheduledOn,
} from "@/lib/series";
import type { Item, TimingSlot } from "@/lib/types";
import TodayHero, { type Pace } from "./TodayHero";
import TodayContextCard from "./TodayContextCard";
import TodayChecklist from "./TodayChecklist";
import AllDoneCard from "./AllDoneCard";
import LogRow from "./LogRow";
import { useTodayData } from "./useTodayData";
import { useTodaySlots } from "./useTodaySlots";
import { useSnoozed } from "./useSnoozed";
import {
  DAY_SLOTS,
  SLOT_START_HOUR,
  groupBySlot,
  isCheckoffSlot,
  ouraWithBaseline,
  todayItems,
  usualPaceByNow,
} from "./model";

// Sheets and once-in-a-while modals load on demand.
const ItemQuickActions = dynamic(() => import("@/components/ItemQuickActions"));
const SkipReasonSheet = dynamic(() => import("@/components/SkipReasonSheet"));
const SwapSheet = dynamic(() => import("@/components/SwapSheet"));
const QuickAddSheet = dynamic(() => import("./QuickAddSheet"));
const ProtocolCompletionModal = dynamic(
  () => import("@/components/ProtocolCompletionModal"),
  { ssr: false },
);
const AchievementsChecker = dynamic(
  () => import("@/components/AchievementsChecker"),
  { ssr: false },
);

export default function TodayPage() {
  const d = useTodayData();
  const { today, logs, loading } = d;
  const daily = useMemo(() => todayItems(d.items), [d.items]);
  const grouped = useMemo(() => groupBySlot(daily), [daily]);
  const snoozed = useSnoozed(useMemo(() => daily.map((i) => i.id), [daily]));
  const slots = useTodaySlots({ grouped, logs, snoozed, loading, today });

  const [moreItem, setMoreItem] = useState<Item | null>(null);
  const [skipItem, setSkipItem] = useState<Item | null>(null);
  const [swapItem, setSwapItem] = useState<Item | null>(null);
  const [addSlot, setAddSlot] = useState<TimingSlot | null>(null);
  const [sheet, setSheet] = useState<"more" | "skip" | "swap" | "add" | null>(
    null,
  );
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  // ---- numbers ---------------------------------------------------------
  const checkoff = daily.filter((i) => isCheckoffSlot(i.timing_slot));
  const total = checkoff.length;
  const taken = checkoff.filter((i) => logs[i.id]?.taken).length;
  const skipped = checkoff.filter(
    (i) => !logs[i.id]?.taken && logs[i.id]?.skipped_reason,
  ).length;
  const dayComplete = total > 0 && taken > 0 && taken + skipped >= total;

  const pace: Pace | null = useMemo(() => {
    const usual = usualPaceByNow(d.allItems, d.history, today, now);
    if (!usual || usual.pct < 5) return null;
    const due = d.items.filter((i) => isScheduledOn(i, today));
    if (due.length === 0) return null;
    const done = due.filter((i) => logs[i.id]?.taken).length;
    return {
      todayPct: Math.round((done / due.length) * 100),
      usualPct: usual.pct,
      days: usual.days,
    };
  }, [d.allItems, d.items, d.history, logs, today, now]);

  const oura = useMemo(() => ouraWithBaseline(d.oura, today), [d.oura, today]);

  const avg14 = useMemo(() => {
    const days = dailyAdherence(
      d.allItems,
      d.history,
      addDaysISO(today, -14),
      addDaysISO(today, -1),
    );
    const r = aggregateAdherence(days).rate;
    return r == null ? null : Math.round(r * 100);
  }, [d.allItems, d.history, today]);

  const tomorrow = useMemo(() => {
    const slot = DAY_SLOTS.find((s) => grouped[s].length > 0);
    return slot
      ? { slot, hour: SLOT_START_HOUR[slot] ?? 6, count: grouped[slot].length }
      : null;
  }, [grouped]);

  // Confetti only when the whole day flips to complete in this session.
  const wasComplete = useRef<boolean | null>(null);
  useEffect(() => {
    if (loading) return;
    if (wasComplete.current === false && dayComplete) {
      fireConfetti({ count: 48 });
    }
    wasComplete.current = dayComplete;
  }, [dayComplete, loading]);

  // After a quick-add: once the new item is in the list, scroll to it.
  useEffect(() => {
    if (!highlightId) return;
    const el = document.getElementById(`today-item-${highlightId}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(() => setHighlightId(null), 2200);
    return () => clearTimeout(t);
  }, [highlightId, daily]);

  const postopDay =
    d.profile?.postopDate != null
      ? daysBetween(d.profile.postopDate.slice(0, 10), today)
      : null;
  const eyebrow = [
    now.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    postopDay != null && postopDay >= 0 ? `Day ${postopDay}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (loading) {
    return (
      <div className="pb-24">
        <PageHeader eyebrow={eyebrow} title="Today" />
        <div className="h-[200px] animate-pulse rounded-[20px] bg-[var(--surface)]" />
        <div className="mt-6 mb-3">
          <SkeletonLine width={140} height={14} />
        </div>
        <SkeletonItemList count={5} />
      </div>
    );
  }

  return (
    <div className="pb-24">
      <PageHeader eyebrow={eyebrow} title="Today" />

      {daily.length === 0 ? (
        <EmptyToday displayName={d.profile?.displayName} />
      ) : (
        <>
          <TodayHero
            taken={taken}
            total={total}
            streak={d.streak}
            pace={pace}
            oura={oura}
          />
          {dayComplete ? (
            <AllDoneCard
              taken={taken}
              skipped={skipped}
              streak={d.streak}
              avg14={avg14}
              tomorrow={tomorrow}
            />
          ) : (
            <TodayContextCard
              streak={d.streak}
              takenCount={taken}
              totalActive={total}
            />
          )}

          <TodayChecklist
            activeSlot={slots.active}
            onChangeSlot={slots.setActive}
            slotStats={slots.stats}
            totalTaken={taken}
            totalAll={total}
            grouped={grouped}
            logs={logs}
            adherence={d.adherence}
            snoozed={snoozed}
            highlightId={highlightId}
            onToggle={d.toggle}
            onMore={(item) => {
              setMoreItem(item);
              setSheet("more");
            }}
            onMarkAll={(ids) => d.setTakenMany(ids, true)}
            onUnmarkAll={(ids) => d.setTakenMany(ids, false)}
            onAdd={(slot) => {
              setAddSlot(slot);
              setSheet("add");
            }}
          />

          <LogRow
            intake={d.intake}
            waterTargetOz={d.profile?.waterTargetOz ?? null}
            proteinTargetG={d.profile?.proteinTargetG ?? null}
          />
        </>
      )}

      {moreItem && (
        <ItemQuickActions
          item={moreItem}
          open={sheet === "more"}
          onClose={() => setSheet(null)}
          onSkip={
            isCheckoffSlot(moreItem.timing_slot) && !logs[moreItem.id]?.taken
              ? (item) => {
                  setSkipItem(item);
                  setSheet("skip");
                }
              : undefined
          }
          onSwap={(item) => {
            setSwapItem(item);
            setSheet("swap");
          }}
        />
      )}
      {skipItem && (
        <SkipReasonSheet
          item={skipItem}
          open={sheet === "skip"}
          onClose={() => setSheet(null)}
          onSelect={(item, reason) => void d.skip(item, reason)}
        />
      )}
      {swapItem && (
        <SwapSheet
          item={swapItem}
          date={today}
          open={sheet === "swap"}
          onClose={() => setSheet(null)}
          onSwapped={d.reload}
        />
      )}
      {addSlot && (
        <QuickAddSheet
          slot={addSlot}
          open={sheet === "add"}
          onClose={() => setSheet(null)}
          onAdded={(id, slot) => {
            d.reload();
            slots.setActive(slot);
            setHighlightId(id);
          }}
        />
      )}

      <ProtocolCompletionModal />
      <AchievementsChecker />
    </div>
  );
}
