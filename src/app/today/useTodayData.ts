"use client";

// One data load for /today. Everything the screen needs — items, today's
// check-offs, 14 days of history (adherence sparklines + pace), streak,
// Oura baseline, profile and intake — in a single parallel fetch, passed
// down as props. Replaces the separate stack_log queries StreakCounter,
// StreakAtRiskBanner and DailyScore each used to make.
//
// Mutations are optimistic with rollback: the UI flips first, the write
// is a single upsert (lib/storage.ts), and a failure restores the
// previous state and shows an error toast.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  clearSkip,
  logSkip,
  setTaken,
} from "@/lib/storage";
import { loadStreak } from "@/lib/streak";
import { addDaysISO, localDateISO, perItemAdherence } from "@/lib/series";
import { calcMacros } from "@/lib/macros";
import { showToast } from "@/lib/toast";
import type { Item } from "@/lib/types";
import type { HistoryLog, OuraDay } from "./model";

export type LogState = { taken: boolean; skipped_reason: string | null };

export type TodayProfile = {
  displayName: string | null;
  postopDate: string | null;
  waterTargetOz: number | null;
  proteinTargetG: number | null;
};

export type TodayIntake = { waterOz: number; proteinG: number } | null;

const PAGE = 1000;

function haptic() {
  try {
    navigator.vibrate?.(8);
  } catch {}
}

export function useTodayData() {
  const [today] = useState(() => localDateISO());
  const [loading, setLoading] = useState(true);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [logs, setLogs] = useState<Record<string, LogState>>({});
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [streak, setStreak] = useState<number | null>(null);
  /** Whether the loaded streak already counted today. */
  const [streakHadToday, setStreakHadToday] = useState(false);
  const [oura, setOura] = useState<OuraDay[]>([]);
  const [profile, setProfile] = useState<TodayProfile | null>(null);
  const [intake, setIntake] = useState<TodayIntake>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Latest logs for rollback inside async handlers.
  const logsRef = useRef(logs);
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Coach approvals, quick-adds, retire etc. broadcast this event.
  useEffect(() => {
    window.addEventListener("regimen:items-changed", reload);
    return () => window.removeEventListener("regimen:items-changed", reload);
  }, [reload]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const c = createClient();
      const from14 = addDaysISO(today, -14);

      // 14 days × ~40 items can exceed the 1000-row response cap, so page.
      async function loadHistory(): Promise<HistoryLog[]> {
        const out: HistoryLog[] = [];
        for (let p = 0; p < 5; p++) {
          const { data, error } = await c
            .from("stack_log")
            .select("item_id, date, taken, skipped_reason, logged_at")
            .gte("date", from14)
            .lte("date", today)
            .order("date", { ascending: false })
            .range(p * PAGE, p * PAGE + PAGE - 1);
          if (error) {
            console.error("today: stack_log history", error);
            break;
          }
          out.push(...((data ?? []) as HistoryLog[]));
          if ((data ?? []).length < PAGE) break;
        }
        return out;
      }

      const [itemsRes, hist, streakN, ouraRes, profRes, intakeRes] =
        await Promise.all([
          c
            .from("items")
            .select("*")
            .in("status", ["active", "retired"])
            .order("created_at", { ascending: true }),
          loadHistory(),
          loadStreak(c, today).catch(() => null),
          c
            .from("oura_daily")
            .select(
              "date, readiness, hrv, rhr, sleep_score, total_sleep_min, wake_time",
            )
            .gte("date", addDaysISO(today, -30))
            .lte("date", today),
          c
            .from("profiles")
            .select(
              "display_name, weight_kg, height_cm, age, biological_sex, activity_level, body_goal, meals_per_day, postop_date, water_target_oz",
            )
            .maybeSingle(),
          c.from("intake_log").select("water_oz, protein_g").eq("date", today),
        ]);
      if (!alive) return;
      if (itemsRes.error) console.error("today: items", itemsRes.error);
      if (ouraRes.error) console.error("today: oura", ouraRes.error);
      if (profRes.error) console.error("today: profile", profRes.error);

      setAllItems((itemsRes.data ?? []) as Item[]);
      setHistory(hist);
      const map: Record<string, LogState> = {};
      for (const l of hist) {
        if (l.date !== today) continue;
        map[l.item_id] = {
          taken: !!l.taken,
          skipped_reason: l.skipped_reason ?? null,
        };
      }
      setLogs(map);
      setStreak(streakN);
      setStreakHadToday(hist.some((l) => l.date === today && l.taken));
      setOura((ouraRes.data ?? []) as OuraDay[]);

      const p = profRes.data;
      let proteinTargetG: number | null = null;
      if (p?.weight_kg && p.height_cm && p.age && p.biological_sex) {
        // Post-op protein bump only for users who actually set a
        // postop_date (no founder-date fallback).
        const postOp =
          !!p.postop_date &&
          new Date(p.postop_date).getTime() > Date.now() - 180 * 86400000;
        proteinTargetG = calcMacros({
          weight_kg: p.weight_kg,
          height_cm: p.height_cm,
          age: p.age,
          biological_sex: p.biological_sex,
          activity_level: p.activity_level ?? "moderate",
          body_goal: p.body_goal ?? "maintain",
          meals_per_day: p.meals_per_day ?? 3,
          post_op: postOp,
        }).protein_g;
      }
      setProfile({
        displayName: p?.display_name ?? null,
        postopDate: p?.postop_date ?? null,
        waterTargetOz: p?.water_target_oz ?? null,
        proteinTargetG,
      });
      if (!intakeRes.error) {
        const rows = (intakeRes.data ?? []) as {
          water_oz: number | string | null;
          protein_g: number | string | null;
        }[];
        setIntake({
          waterOz: Math.round(
            rows.reduce((s, r) => s + Number(r.water_oz ?? 0), 0),
          ),
          proteinG: Math.round(
            rows.reduce((s, r) => s + Number(r.protein_g ?? 0), 0),
          ),
        });
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [today, reloadKey]);

  const items = useMemo(
    () => allItems.filter((i) => i.status === "active"),
    [allItems],
  );

  /** 14-day per-item adherence (rate + daily series), today excluded so
   *  an unchecked morning doesn't read as a miss. */
  const adherence = useMemo(() => {
    const from = addDaysISO(today, -14);
    const to = addDaysISO(today, -1);
    return perItemAdherence(items, history, from, to);
  }, [items, history, today]);

  /** Streak that reacts to check-offs: today joins (or leaves) the run
   *  as soon as the first dose is taken (or the last one un-taken). */
  const liveStreak = useMemo(() => {
    if (streak == null) return null;
    const anyToday = Object.values(logs).some((l) => l.taken);
    return Math.max(0, streak - (streakHadToday ? 1 : 0) + (anyToday ? 1 : 0));
  }, [streak, streakHadToday, logs]);

  // ---- mutations -------------------------------------------------------

  const patch = useCallback(
    (next: Record<string, LogState | undefined>) => {
      setLogs((prev) => {
        const out = { ...prev };
        for (const [id, v] of Object.entries(next)) {
          if (v) out[id] = v;
          else delete out[id];
        }
        return out;
      });
    },
    [],
  );

  /** Set taken for one or more items, optimistically. Returns false
   *  (after rolling back) when the write failed. */
  const setTakenMany = useCallback(
    async (ids: string[], taken: boolean): Promise<boolean> => {
      const before: Record<string, LogState | undefined> = {};
      const after: Record<string, LogState> = {};
      for (const id of ids) {
        before[id] = logsRef.current[id];
        after[id] = { taken, skipped_reason: null };
      }
      patch(after);
      haptic();
      const results = await Promise.allSettled(
        ids.map((id) => setTaken(today, id, taken)),
      );
      const failed = ids.filter((_, i) => results[i].status === "rejected");
      if (failed.length > 0) {
        patch(Object.fromEntries(failed.map((id) => [id, before[id]])));
        showToast(
          failed.length === 1
            ? "Couldn't save that. Check your connection and try again."
            : `Couldn't save ${failed.length} items. Try again.`,
          { tone: "error" },
        );
        return false;
      }
      return true;
    },
    [patch, today],
  );

  const toggle = useCallback(
    (item: Item) => {
      const cur = logsRef.current[item.id]?.taken ?? false;
      return setTakenMany([item.id], !cur);
    },
    [setTakenMany],
  );

  const skip = useCallback(
    async (item: Item, reason: string) => {
      const before = logsRef.current[item.id];
      patch({ [item.id]: { taken: false, skipped_reason: reason } });
      try {
        await logSkip(today, item.id, reason);
      } catch {
        patch({ [item.id]: before });
        showToast("Couldn't save the skip. Try again.", { tone: "error" });
        return;
      }
      showToast(`Skipped ${item.name}`, {
        undo: async () => {
          patch({ [item.id]: before });
          try {
            if (before?.taken) await setTaken(today, item.id, true);
            else await clearSkip(today, item.id);
          } catch {
            patch({ [item.id]: { taken: false, skipped_reason: reason } });
            showToast("Couldn't undo. Try again.", { tone: "error" });
          }
        },
      });
    },
    [patch, today],
  );

  return {
    today,
    loading,
    items,
    allItems,
    logs,
    history,
    streak: liveStreak,
    oura,
    profile,
    intake,
    adherence,
    reload,
    toggle,
    setTakenMany,
    skip,
  };
}

export type TodayData = ReturnType<typeof useTodayData>;
