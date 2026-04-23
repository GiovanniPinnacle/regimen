"use client";

import { useEffect, useMemo, useState } from "react";
import ItemCard from "@/components/ItemCard";
import SymptomForm from "@/components/SymptomForm";
import InsightsBanner from "@/components/InsightsBanner";
import type { Item, ItemType, TimingSlot } from "@/lib/types";
import {
  getItemsByStatus,
  getTakenMap,
  toggleTaken,
} from "@/lib/storage";
import {
  DAILY_LOGGABLE_TYPES,
  TIMING_LABELS,
  TIMING_ORDER,
  daysSincePostOp,
  todayISO,
} from "@/lib/constants";

const NON_CHECKOFF_SLOTS: TimingSlot[] = ["situational"];

export default function TodayPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [taken, setTakenState] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const today = todayISO();
  const dayPostOp = daysSincePostOp();

  useEffect(() => {
    (async () => {
      const active = await getItemsByStatus("active");
      setItems(active);
      const map = await getTakenMap(today);
      setTakenState(map);
      setLoading(false);
    })();
  }, [today]);

  // Only daily-loggable types land on Today
  const daily = useMemo(
    () =>
      items.filter((i) => DAILY_LOGGABLE_TYPES.includes(i.item_type as ItemType)),
    [items],
  );

  const grouped = useMemo(() => {
    const map: Record<TimingSlot, Item[]> = {
      pre_breakfast: [],
      breakfast: [],
      pre_workout: [],
      lunch: [],
      dinner: [],
      pre_bed: [],
      ongoing: [],
      situational: [],
    };
    for (const item of daily) map[item.timing_slot].push(item);
    return map;
  }, [daily]);

  const checkoffItems = daily.filter(
    (i) => !NON_CHECKOFF_SLOTS.includes(i.timing_slot),
  );
  const totalActive = checkoffItems.length;
  const takenCount = checkoffItems.filter((i) => taken[i.id]).length;

  async function handleToggle(id: string) {
    const newVal = await toggleTaken(today, id);
    setTakenState((prev) => ({ ...prev, [id]: newVal }));
  }

  if (loading) {
    return (
      <div className="py-12 text-center" style={{ color: "var(--muted)" }}>
        Loading…
      </div>
    );
  }

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="pb-24">
      <header className="mb-6">
        <h1 className="text-[26px] leading-tight" style={{ fontWeight: 500 }}>
          Today
        </h1>
        <div
          className="text-[13px] mt-1"
          style={{ color: "var(--muted)" }}
        >
          {dateLabel} · Day {dayPostOp} post-op · {takenCount}/{totalActive} logged
        </div>
      </header>

      <InsightsBanner />

      {TIMING_ORDER.map((slot) => {
        const list = grouped[slot];
        if (list.length === 0) return null;
        return (
          <section key={slot} className="mb-8">
            <h2
              className="text-[11px] uppercase tracking-wider mb-3"
              style={{ color: "var(--muted)", fontWeight: 500 }}
            >
              {TIMING_LABELS[slot]}
            </h2>
            <div className="flex flex-col gap-2">
              {list.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  taken={taken[item.id] ?? false}
                  onToggle={
                    NON_CHECKOFF_SLOTS.includes(slot) ? undefined : handleToggle
                  }
                  showGoals={false}
                  showTypeIcon={false}
                />
              ))}
            </div>
          </section>
        );
      })}

      <section className="mt-10">
        <h2
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          How are you today?
        </h2>
        <SymptomForm date={today} />
      </section>
    </div>
  );
}
