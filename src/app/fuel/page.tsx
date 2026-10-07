"use client";

// /fuel — what went in. Today's intake vs targets on top (water,
// protein, calories + one-tap water and a single "Log a meal" entry into
// the universal capture sheet), then the history that makes it useful:
// 14/30-day protein and calorie bars against target, protein hit-rate
// and streak, eating window, one-tap re-logs, and recipes.

import { fetchAllRowsResult } from "@/lib/supabase/paginate";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import IntakeTracker, { DEFAULT_WATER_TARGET_OZ } from "@/components/IntakeTracker";
import PageHeader from "@/components/ui/PageHeader";
import { SectionHeader, Stat } from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import Button, { ButtonLink } from "@/components/ui/Button";
import { ListGroup } from "@/components/ui/ListRow";
import Segmented from "@/components/ui/Segmented";
import Icon from "@/components/Icon";
import { BarChart } from "@/components/charts";
import { createClient } from "@/lib/supabase/client";
import { calcMacros, type MacroTargets } from "@/lib/macros";
import { addDaysISO, lastNDays, localDateISO } from "@/lib/series";
import { showToast } from "@/lib/toast";
import { openCoach } from "@/lib/coach-events";

type FrequentMeal = {
  content: string;
  kind: "meal" | "snack";
  calories: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  serving: string | null;
  occurrences: number;
};

type IntakeRow = {
  date: string;
  kind: string;
  logged_at: string;
  calories: number | null;
  protein_g: number | string | null;
  water_oz: number | string | null;
};

type RecipeRow = {
  id: string;
  name: string;
  calories_per_serving: number | null;
  protein_g: number | null;
  is_favorite: boolean;
};

type DayTotals = {
  date: string;
  protein: number;
  calories: number;
  water: number;
  meals: number;
  first: number | null; // minutes after midnight
  last: number | null;
};

const HISTORY_DAYS = 30;

function minutesOfDay(ts: string): number {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
}

function fmtClock(min: number): string {
  const d = new Date(2000, 0, 1, Math.floor(min / 60), Math.round(min % 60));
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function FuelPage() {
  const [macros, setMacros] = useState<MacroTargets | null>(null);
  const [waterTarget, setWaterTarget] = useState<number>(DEFAULT_WATER_TARGET_OZ);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [rows, setRows] = useState<IntakeRow[] | null>(null);
  const [frequent, setFrequent] = useState<FrequentMeal[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [range, setRange] = useState<"14" | "30">("14");
  const [logging, setLogging] = useState<string | null>(null);

  const today = localDateISO();

  const loadHistory = useCallback(async () => {
    const client = createClient();
    const from = addDaysISO(localDateISO(), -(HISTORY_DAYS - 1));
    const { data, error } = await fetchAllRowsResult<IntakeRow>((lo, hi) =>
      client
        .from("intake_log")
        .select("date, kind, logged_at, calories, protein_g, water_oz")
        .gte("date", from)
        .order("logged_at", { ascending: true })
        .order("id", { ascending: true })
        .range(lo, hi),
    );
    if (error) console.error("fuel: intake_log history", error);
    setRows((data ?? []) as IntakeRow[]);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const client = createClient();
      const [profileRes, recipesRes, freqRes] = await Promise.all([
        client
          .from("profiles")
          .select(
            "weight_kg, height_cm, age, biological_sex, activity_level, body_goal, meals_per_day, postop_date, water_target_oz",
          )
          .maybeSingle(),
        client
          .from("recipes")
          .select("id, name, calories_per_serving, protein_g, is_favorite")
          .order("is_favorite", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(3),
        fetch("/api/intake/frequent", { credentials: "include" })
          .then((r) => (r.ok ? r.json() : { meals: [] }))
          .catch(() => ({ meals: [] })),
      ]);
      if (!alive) return;
      const p = profileRes.data;
      if (p?.weight_kg && p.height_cm && p.age && p.biological_sex) {
        // Post-op protein bump only when the user actually set a
        // procedure date in the last 180 days.
        const postOp =
          !!p.postop_date &&
          new Date(p.postop_date).getTime() > Date.now() - 180 * 86400000;
        setMacros(
          calcMacros({
            weight_kg: p.weight_kg,
            height_cm: p.height_cm,
            age: p.age,
            biological_sex: p.biological_sex,
            activity_level: p.activity_level ?? "moderate",
            body_goal: p.body_goal ?? "maintain",
            meals_per_day: p.meals_per_day ?? 3,
            post_op: postOp,
          }),
        );
      }
      setWaterTarget(
        (p?.water_target_oz as number | null) ?? DEFAULT_WATER_TARGET_OZ,
      );
      setProfileLoaded(true);
      setRecipes((recipesRes.data ?? []) as RecipeRow[]);
      setFrequent(
        (((freqRes as { meals?: FrequentMeal[] }).meals ?? []) as FrequentMeal[]).slice(0, 5),
      );
    })();
    const id = setTimeout(() => void loadHistory(), 0);
    const onChange = () => void loadHistory();
    window.addEventListener("regimen:items-changed", onChange);
    window.addEventListener("regimen:intake-changed", onChange);
    return () => {
      alive = false;
      clearTimeout(id);
      window.removeEventListener("regimen:items-changed", onChange);
      window.removeEventListener("regimen:intake-changed", onChange);
    };
  }, [loadHistory]);

  // Per-day totals for the full 30-day window.
  const days = useMemo<DayTotals[]>(() => {
    const keys = lastNDays(HISTORY_DAYS, today);
    const map = new Map<string, DayTotals>(
      keys.map((d) => [
        d,
        { date: d, protein: 0, calories: 0, water: 0, meals: 0, first: null, last: null },
      ]),
    );
    for (const r of rows ?? []) {
      const d = map.get(r.date.slice(0, 10));
      if (!d) continue;
      d.protein += Number(r.protein_g ?? 0);
      d.calories += Number(r.calories ?? 0);
      d.water += Number(r.water_oz ?? 0);
      if (r.kind === "meal" || r.kind === "snack") {
        d.meals++;
        const m = minutesOfDay(r.logged_at);
        d.first = d.first == null ? m : Math.min(d.first, m);
        d.last = d.last == null ? m : Math.max(d.last, m);
      }
    }
    return keys.map((k) => map.get(k)!);
  }, [rows, today]);

  const n = Number(range);
  const windowDays = days.slice(-n);
  const proteinTarget = macros?.protein_g ?? null;
  const calTarget = macros?.calories ?? null;

  const stats = useMemo(() => {
    // Completed days only — today is still in progress.
    const past = windowDays.filter((d) => d.date !== today && d.meals > 0);
    const hits =
      proteinTarget != null
        ? past.filter((d) => d.protein >= proteinTarget).length
        : null;
    const hitRate = hits != null && past.length > 0 ? hits / past.length : null;

    // Streak of protein-target days ending today (if hit) or yesterday.
    let streak = 0;
    if (proteinTarget != null) {
      const byDate = new Map(days.map((d) => [d.date, d]));
      const todayRow = byDate.get(today);
      let cursor =
        todayRow && todayRow.protein >= proteinTarget
          ? today
          : addDaysISO(today, -1);
      while ((byDate.get(cursor)?.protein ?? 0) >= proteinTarget) {
        streak++;
        cursor = addDaysISO(cursor, -1);
      }
    }

    const avg = (xs: number[]) =>
      xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
    const firsts = past.map((d) => d.first).filter((x): x is number => x != null);
    const lasts = past.map((d) => d.last).filter((x): x is number => x != null);
    const avgFirst = avg(firsts);
    const avgLast = avg(lasts);
    const avgProtein = avg(past.map((d) => d.protein));
    const avgWater = avg(
      windowDays.filter((d) => d.date !== today && d.water > 0).map((d) => d.water),
    );
    return {
      logged: past.length,
      hits,
      hitRate,
      streak,
      avgFirst,
      avgLast,
      avgProtein,
      avgWater,
    };
  }, [windowDays, days, proteinTarget, today]);

  async function relog(meal: FrequentMeal) {
    if (logging) return;
    setLogging(meal.content);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          kind: meal.kind,
          content: meal.content,
          analyze: meal.calories == null,
          calories: meal.calories ?? undefined,
          protein_g: meal.protein_g ?? undefined,
          fat_g: meal.fat_g ?? undefined,
          carbs_g: meal.carbs_g ?? undefined,
          serving: meal.serving ?? undefined,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        entry?: { id: string };
        error?: string;
      };
      if (!res.ok || !j.entry) throw new Error(j.error ?? "Couldn't log that");
      const id = j.entry.id;
      window.dispatchEvent(new CustomEvent("regimen:intake-changed"));
      showToast(`Logged ${meal.content}`, {
        tone: "success",
        duration: 5000,
        undo: async () => {
          await fetch(`/api/intake?id=${encodeURIComponent(id)}`, {
            method: "DELETE",
          });
          window.dispatchEvent(new CustomEvent("regimen:intake-changed"));
        },
      });
    } catch (e) {
      showToast((e as Error).message, { tone: "error" });
    } finally {
      setLogging(null);
    }
  }

  const hasHistory = (rows ?? []).some(
    (r) => r.kind === "meal" || r.kind === "snack",
  );
  const bars = (key: "protein" | "calories") =>
    windowDays.map((d) => ({
      x: d.date,
      y: d.meals > 0 ? Math.round(d[key]) : null,
    }));

  return (
    <div className="pb-28">
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
        })}
        title="Fuel"
        subtitle="Log in a tap. Coach does the macro math."
      />

      {profileLoaded && (
        <IntakeTracker
          targets={{
            calories: macros?.calories,
            protein_g: macros?.protein_g,
            water_oz: waterTarget,
          }}
        />
      )}

      {frequent.length > 0 && (
        <>
          <SectionHeader title="Log again" eyebrow="Your regulars" />
          <ListGroup>
            {frequent.map((m) => {
              const meta = [
                m.calories != null ? `${m.calories} kcal` : null,
                m.protein_g != null ? `${Math.round(m.protein_g)}g protein` : null,
                `${m.occurrences}× this month`,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <button
                  key={m.content}
                  type="button"
                  onClick={() => relog(m)}
                  disabled={logging != null}
                  className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-[var(--surface-alt)] disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-callout font-medium">
                      {m.content}
                    </span>
                    <span className="block truncate text-caption text-[var(--muted)] tabular-nums">
                      {meta}
                    </span>
                  </span>
                  <span className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-3 text-caption font-semibold">
                    {logging === m.content ? (
                      "Logging…"
                    ) : (
                      <>
                        <Icon name="plus" size={13} strokeWidth={2.2} />
                        Log
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </ListGroup>
        </>
      )}

      <SectionHeader
        title="History"
        eyebrow={`Last ${n} days`}
        action={
          <Segmented
            ariaLabel="History range"
            className="w-[132px]"
            value={range}
            onChange={setRange}
            options={[
              { value: "14", label: "14d" },
              { value: "30", label: "30d" },
            ]}
          />
        }
      />

      {rows == null ? (
        <Card className="h-[180px] animate-pulse" />
      ) : !hasHistory ? (
        <Card padding="lg" className="text-center">
          <p className="text-callout text-[var(--foreground-soft)]">
            Log a few meals and your protein, calorie and timing trends show
            up here.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          <Card padding="md">
            <div className="grid grid-cols-3 gap-3">
              <Stat
                size="sm"
                label="Protein hit"
                value={stats.hitRate != null ? Math.round(stats.hitRate * 100) : "—"}
                unit={stats.hitRate != null ? "%" : undefined}
                sub={
                  stats.hits != null
                    ? `${stats.hits} of ${stats.logged} days`
                    : "Set targets"
                }
              />
              <Stat
                size="sm"
                label="Streak"
                value={stats.streak}
                unit={stats.streak === 1 ? "day" : "days"}
                sub="at protein goal"
              />
              <Stat
                size="sm"
                label="Avg protein"
                value={stats.avgProtein != null ? Math.round(stats.avgProtein) : "—"}
                unit="g"
                sub={proteinTarget != null ? `goal ${proteinTarget}g` : undefined}
              />
            </div>
          </Card>

          <Card padding="md">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-callout font-semibold">Protein</h3>
              <span className="text-caption text-[var(--muted)]">
                grams per day
              </span>
            </div>
            <BarChart
              bars={bars("protein")}
              target={proteinTarget ?? undefined}
              targetLabel="Goal"
              unit="g"
              ariaLabel={`Daily protein, last ${n} days`}
            />
          </Card>

          <Card padding="md">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-callout font-semibold">Calories</h3>
              <span className="text-caption text-[var(--muted)]">
                within 10% of goal shows green
              </span>
            </div>
            <BarChart
              bars={bars("calories")}
              target={calTarget ?? undefined}
              targetLabel="Goal"
              unit=" kcal"
              tone={
                calTarget != null
                  ? (y) =>
                      y > calTarget * 1.1
                        ? "warn"
                        : y >= calTarget * 0.9
                          ? "good"
                          : "neutral"
                  : undefined
              }
              ariaLabel={`Daily calories, last ${n} days`}
            />
          </Card>

          {(stats.avgFirst != null || stats.avgWater != null) && (
            <Card padding="md">
              <div className="grid grid-cols-3 gap-3">
                <Stat
                  size="sm"
                  label="First meal"
                  value={stats.avgFirst != null ? fmtClock(stats.avgFirst) : "—"}
                  sub="average"
                />
                <Stat
                  size="sm"
                  label="Last meal"
                  value={stats.avgLast != null ? fmtClock(stats.avgLast) : "—"}
                  sub={
                    stats.avgFirst != null && stats.avgLast != null
                      ? `${((stats.avgLast - stats.avgFirst) / 60).toFixed(1)} h window`
                      : "average"
                  }
                />
                <Stat
                  size="sm"
                  label="Water"
                  value={stats.avgWater != null ? Math.round(stats.avgWater) : "—"}
                  unit="oz"
                  sub={`goal ${waterTarget} oz`}
                />
              </div>
            </Card>
          )}

          <Button
            variant="coach"
            icon="sparkle"
            fullWidth
            onClick={() =>
              openCoach({
                text: `Look at my last ${n} days of meals, protein and calories against my targets, and my eating window. What's the one change that would help most this week? Suggest 2-3 specific meals that fit.`,
                send: true,
              })
            }
          >
            What should I eat?
          </Button>
        </div>
      )}

      <SectionHeader
        title="Recipes"
        href="/recipes"
        hrefLabel={recipes.length > 0 ? "All recipes" : undefined}
      />
      {recipes.length > 0 ? (
        <ListGroup>
          {recipes.map((r) => (
            <Link
              key={r.id}
              href={`/recipes/${r.id}`}
              className="flex min-h-[56px] items-center gap-3 px-4 py-2.5 active:bg-[var(--surface-alt)]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
                <Icon name={r.is_favorite ? "star" : "book"} size={16} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-callout font-medium">{r.name}</span>
                {r.calories_per_serving != null && (
                  <span className="block truncate text-caption text-[var(--muted)] tabular-nums">
                    {r.calories_per_serving} kcal
                    {r.protein_g != null && ` · ${r.protein_g}g protein`}
                  </span>
                )}
              </span>
              <Icon name="chevron-right" size={16} strokeWidth={2} className="shrink-0 text-[var(--muted)]" />
            </Link>
          ))}
        </ListGroup>
      ) : (
        <Card padding="md">
          <p className="text-footnote text-[var(--muted)]">
            Tell Coach what&apos;s in your fridge and get meals portioned to
            your targets.
          </p>
        </Card>
      )}
      <div className="mt-3">
        <ButtonLink href="/recipes/generate" variant="secondary" icon="sparkle" fullWidth>
          Generate from my fridge
        </ButtonLink>
      </div>
    </div>
  );
}
