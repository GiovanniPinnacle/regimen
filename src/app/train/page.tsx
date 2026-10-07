"use client";

// /train — should I push today, and what have I actually done?
//
//   1. Today's call — Oura readiness vs the user's own 28-day baseline
//      (plus HRV / resting HR / sleep) → "Train hard", "Go easy" or
//      "Rest", with the numbers behind it.
//   2. Readiness trend — 30 days with the personal baseline band.
//   3. Training log — sessions from workout check-ins and captures
//      tagged "workout": weekly count, last sessions, and readiness on
//      training vs rest days.
//   4. Training practices in the stack.
//
// Logging goes through the universal capture sheet with hint "workout".

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { SectionHeader, Stat } from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { ListGroup } from "@/components/ui/ListRow";
import Chip from "@/components/ui/Chip";
import Icon, { type IconName } from "@/components/Icon";
import MetricDelta from "@/components/MetricDelta";
import { BarChart, BeforeAfterBar, LineChart } from "@/components/charts";
import { weekdayMon0 } from "@/components/charts/scale";
import { createClient } from "@/lib/supabase/client";
import { addDaysISO, lastNDays, localDateISO, windowStats } from "@/lib/series";
import { openCoach } from "@/lib/coach-events";

type OuraRow = {
  date: string;
  readiness: number | null;
  hrv: number | null;
  rhr: number | null;
  total_sleep_min: number | null;
};

type Session = {
  key: string;
  date: string;
  text: string;
  source: "checkin" | "capture";
};

type PracticeRow = {
  id: string;
  name: string;
  item_type: string;
  timing_slot: string;
  how_to: string | null;
  usage_notes: string | null;
};

const BASELINE_DAYS = 28;
const LOG_WEEKS = 8;
const TRAIN_RE =
  /gym|workout|lift|squat|deadlift|press|pull-?up|row|mobility|stretch|yoga|cardio|zone ?2|walk|run|sprint|sauna|cold|plunge|swim|bike|hiit|pilates|train/i;

type Call = {
  label: "Train hard" | "Go easy" | "Rest";
  icon: IconName;
  tone: "success" | "warn" | "danger";
  why: string;
};

function makeCall(
  readiness: number,
  base: { mean: number | null; sd: number | null },
  hrv: number | null,
  hrvBase: number | null,
): Call {
  const mean = base.mean ?? 75;
  const sd = Math.max(4, base.sd ?? 6);
  const z = (readiness - mean) / sd;
  const hrvDrop = hrv != null && hrvBase != null && hrv < hrvBase * 0.85;
  if (readiness < 60 || z <= -1.5) {
    return {
      label: "Rest",
      icon: "bed",
      tone: "danger",
      why: "Recovery is well below your normal. A walk, mobility or a full day off will pay back more than a hard session.",
    };
  }
  if (z < -0.5 || hrvDrop) {
    return {
      label: "Go easy",
      icon: "leaf",
      tone: "warn",
      why: hrvDrop
        ? "HRV is down more than 15% from your baseline. Keep it light: zone 2, technique work, or a shorter session."
        : "A bit under your usual. Train, but cap the intensity — skip the max-effort sets today.",
    };
  }
  return {
    label: "Train hard",
    icon: "zap",
    tone: "success",
    why:
      z >= 0.5
        ? "You're recovered above your usual. Good day for heavy lifts or intervals."
        : "Right around your normal. A full, planned session is fine.",
  };
}

function fmtSleep(min: number | null) {
  if (min == null) return "—";
  return `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, "0")}m`;
}

function relDay(iso: string, today: string) {
  if (iso === today) return "Today";
  if (iso === addDaysISO(today, -1)) return "Yesterday";
  return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function TrainPage() {
  const [oura, setOura] = useState<OuraRow[] | null>(null);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [practices, setPractices] = useState<PracticeRow[]>([]);
  const today = localDateISO();

  useEffect(() => {
    let alive = true;
    async function load() {
      const client = createClient();
      const now = localDateISO();
      const ouraFrom = addDaysISO(now, -(BASELINE_DAYS + 35));
      const logFrom = addDaysISO(now, -(LOG_WEEKS * 7 + 7));
      const [ouraRes, checkinRes, memoRes, itemsRes] = await Promise.all([
        client
          .from("oura_daily")
          .select("date, readiness, hrv, rhr, total_sleep_min")
          .gte("date", ouraFrom)
          .order("date", { ascending: true })
          .limit(200),
        client
          .from("daily_checkins")
          .select("id, date, workout_text")
          .eq("checkin_window", "workout")
          .not("workout_text", "is", null)
          .gte("date", logFrom)
          .order("date", { ascending: false })
          .limit(200),
        client
          .from("voice_memos")
          .select("id, transcript, created_at")
          .eq("context_tag", "workout")
          .gte("created_at", `${logFrom}T00:00:00`)
          .order("created_at", { ascending: false })
          .limit(200),
        client
          .from("items")
          .select("id, name, item_type, timing_slot, how_to, usage_notes")
          .eq("status", "active")
          .in("item_type", ["practice", "device"])
          .order("name")
          .limit(200),
      ]);
      if (!alive) return;
      if (ouraRes.error) console.error("train: oura_daily", ouraRes.error);
      if (checkinRes.error) console.error("train: daily_checkins", checkinRes.error);
      if (memoRes.error) console.error("train: voice_memos", memoRes.error);
      setOura((ouraRes.data ?? []) as OuraRow[]);
      const s: Session[] = [
        ...((checkinRes.data ?? []) as { id: string; date: string; workout_text: string }[]).map(
          (r) => ({
            key: `c-${r.id}`,
            date: r.date.slice(0, 10),
            text: r.workout_text,
            source: "checkin" as const,
          }),
        ),
        ...((memoRes.data ?? []) as { id: string; transcript: string; created_at: string }[]).map(
          (r) => ({
            key: `m-${r.id}`,
            date: localDateISO(new Date(r.created_at)),
            text: r.transcript,
            source: "capture" as const,
          }),
        ),
      ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      setSessions(s);
      setPractices(
        ((itemsRes.data ?? []) as PracticeRow[]).filter((i) =>
          TRAIN_RE.test(`${i.name} ${i.usage_notes ?? ""}`),
        ),
      );
    }
    void load();
    const onChange = () => void load();
    window.addEventListener("regimen:items-changed", onChange);
    return () => {
      alive = false;
      window.removeEventListener("regimen:items-changed", onChange);
    };
  }, []);

  // ---- Readiness vs baseline -------------------------------------------
  const readinessModel = useMemo(() => {
    if (!oura || oura.length === 0) return null;
    const withReady = oura.filter((r) => r.readiness != null);
    const latest = withReady[withReady.length - 1];
    if (!latest) return null;
    const baseTo = addDaysISO(latest.date, -1);
    const baseFrom = addDaysISO(latest.date, -BASELINE_DAYS);
    const series = (k: keyof OuraRow) =>
      oura.map((r) => ({ date: r.date, value: r[k] as number | null }));
    const ready = windowStats(series("readiness"), baseFrom, baseTo);
    const hrv = windowStats(series("hrv"), baseFrom, baseTo);
    const rhr = windowStats(series("rhr"), baseFrom, baseTo);
    const sleep = windowStats(series("total_sleep_min"), baseFrom, baseTo);
    const call = makeCall(latest.readiness!, ready, latest.hrv, hrv.mean);
    return { latest, ready, hrv, rhr, sleep, call, isToday: latest.date === today };
  }, [oura, today]);

  const trend = useMemo(() => {
    if (!oura) return [];
    const byDate = new Map(oura.map((r) => [r.date, r.readiness]));
    return lastNDays(30, today).map((d) => ({ x: d, y: byDate.get(d) ?? null }));
  }, [oura, today]);

  // ---- Training log ------------------------------------------------------
  const log = useMemo(() => {
    if (!sessions) return null;
    const days = new Set(sessions.map((s) => s.date));
    const thisWeekStart = addDaysISO(today, -weekdayMon0(today));
    const weeks = Array.from({ length: LOG_WEEKS }, (_, i) =>
      addDaysISO(thisWeekStart, -7 * (LOG_WEEKS - 1 - i)),
    );
    const weekly = weeks.map((start) => {
      let c = 0;
      for (let k = 0; k < 7; k++) if (days.has(addDaysISO(start, k))) c++;
      return { x: start, y: c };
    });
    const completed = weekly.slice(0, -1);
    const avg =
      completed.length > 0
        ? completed.reduce((s, w) => s + w.y, 0) / completed.length
        : null;
    const last = sessions[0]?.date ?? null;
    const daysSince =
      last != null
        ? Math.round(
            (new Date(today + "T12:00:00").getTime() -
              new Date(last + "T12:00:00").getTime()) /
              86400000,
          )
        : null;

    // Readiness on training days vs rest days (last 8 weeks).
    let trainSum = 0,
      trainN = 0,
      restSum = 0,
      restN = 0;
    for (const r of oura ?? []) {
      if (r.readiness == null || r.date < weeks[0] || r.date > today) continue;
      if (days.has(r.date)) {
        trainSum += r.readiness;
        trainN++;
      } else {
        restSum += r.readiness;
        restN++;
      }
    }
    return {
      weekly,
      thisWeek: weekly[weekly.length - 1].y,
      avg,
      daysSince,
      recent: sessions.slice(0, 6),
      compare:
        trainN > 0 && restN > 0
          ? {
              train: { mean: trainSum / trainN, n: trainN },
              rest: { mean: restSum / restN, n: restN },
            }
          : null,
    };
  }, [sessions, oura, today]);

  function captureWorkout() {
    window.dispatchEvent(
      new CustomEvent("regimen:capture", { detail: { hint: "workout" } }),
    );
  }

  const m = readinessModel;
  const toneCls = m
    ? m.call.tone === "success"
      ? "bg-[var(--success-tint)] text-[var(--success)]"
      : m.call.tone === "warn"
        ? "bg-[var(--warn-tint)] text-[var(--warn)]"
        : "bg-[var(--error-tint)] text-[var(--error)]"
    : "";

  return (
    <div className="pb-28">
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, {
          weekday: "long",
          month: "short",
          day: "numeric",
        })}
        title="Train"
        subtitle="Readiness, training load and recovery."
      />

      {/* ---- Today's call ---- */}
      {oura == null ? (
        <Card className="h-[220px] animate-pulse" />
      ) : m ? (
        <Card padding="lg" variant="raised">
          <div className="flex items-start gap-3">
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${toneCls}`}
            >
              <Icon name={m.call.icon} size={22} strokeWidth={1.9} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-eyebrow uppercase text-[var(--muted)]">
                {m.isToday ? "Today's call" : `Based on ${relDay(m.latest.date, today)}`}
              </div>
              <div className="text-title-1">{m.call.label}</div>
            </div>
          </div>
          <p className="mt-3 text-callout text-[var(--foreground-soft)]">
            {m.call.why}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-[var(--border)] pt-4">
            <Stat
              size="sm"
              label="Average readiness"
              value={m.latest.readiness}
              delta={
                m.ready.mean != null ? (
                  <MetricDelta
                    delta={Math.round(m.latest.readiness! - m.ready.mean)}
                    baseline={`vs ${Math.round(m.ready.mean)} usual`}
                  />
                ) : undefined
              }
            />
            <Stat
              size="sm"
              label="HRV"
              value={m.latest.hrv ?? "—"}
              unit={m.latest.hrv != null ? "ms" : undefined}
              delta={
                m.latest.hrv != null && m.hrv.mean != null ? (
                  <MetricDelta
                    delta={Math.round(m.latest.hrv - m.hrv.mean)}
                    baseline={`vs ${Math.round(m.hrv.mean)}`}
                    unit=" ms"
                  />
                ) : undefined
              }
            />
            <Stat
              size="sm"
              label="Resting HR"
              value={m.latest.rhr ?? "—"}
              unit={m.latest.rhr != null ? "bpm" : undefined}
              delta={
                m.latest.rhr != null && m.rhr.mean != null ? (
                  <MetricDelta
                    delta={Math.round(m.latest.rhr - m.rhr.mean)}
                    baseline={`vs ${Math.round(m.rhr.mean)}`}
                    direction="good_lower"
                  />
                ) : undefined
              }
            />
            <Stat
              size="sm"
              label="Sleep"
              value={fmtSleep(m.latest.total_sleep_min)}
              sub={
                m.sleep.mean != null ? `usual ${fmtSleep(m.sleep.mean)}` : undefined
              }
            />
          </div>
          <p className="mt-3 text-caption text-[var(--muted)]">
            Baseline = your average over the previous {BASELINE_DAYS} days.
          </p>
        </Card>
      ) : (
        <Card padding="lg">
          <div className="text-title-3">No readiness data yet</div>
          <p className="mt-1 text-callout text-[var(--foreground-soft)]">
            Connect Oura and Regimen will compare each morning to your own
            baseline and tell you whether to push, go easy or rest.
          </p>
          <Link
            href="/you"
            className="mt-3 inline-flex min-h-[44px] items-center gap-1 text-callout font-semibold"
          >
            Connect in You
            <Icon name="chevron-right" size={16} strokeWidth={2} />
          </Link>
        </Card>
      )}

      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <Button variant="primary" icon="plus" onClick={captureWorkout}>
          Log a workout
        </Button>
        <Button
          variant="coach"
          icon="sparkle"
          onClick={() =>
            openCoach({
              text: "Look at my readiness vs my baseline, HRV, sleep and my last two weeks of training. What should I do today — and if I train, what specifically? Keep it short.",
              send: true,
            })
          }
        >
          Plan today
        </Button>
      </div>

      {/* ---- Readiness trend ---- */}
      {m && (
        <>
          <SectionHeader title="Readiness" eyebrow="Last 30 days" />
          <Card padding="md">
            <LineChart
              points={trend}
              rolling={7}
              band={
                m.ready.mean != null
                  ? {
                      lo: Math.round(m.ready.mean - Math.max(4, m.ready.sd ?? 6) * 0.5),
                      hi: Math.round(m.ready.mean + Math.max(4, m.ready.sd ?? 6) * 0.5),
                      label: "Your usual",
                    }
                  : undefined
              }
              ariaLabel="Oura readiness, last 30 days"
            />
          </Card>
        </>
      )}

      {/* ---- Training log ---- */}
      <SectionHeader title="Training log" eyebrow={`Last ${LOG_WEEKS} weeks`} />
      {log == null ? (
        <Card className="h-[200px] animate-pulse" />
      ) : log.recent.length === 0 ? (
        <Card padding="lg">
          <p className="text-callout text-[var(--foreground-soft)]">
            No sessions logged yet. Tap{" "}
            <span className="font-semibold text-[var(--foreground)]">
              Log a workout
            </span>{" "}
            and say what you did — &ldquo;squat 5×5 at 225, 20 min zone 2&rdquo;
            is plenty.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          <Card padding="md">
            <div className="grid grid-cols-3 gap-3">
              <Stat size="sm" label="This week" value={log.thisWeek} unit={log.thisWeek === 1 ? "session" : "sessions"} />
              <Stat
                size="sm"
                label="Weekly avg"
                value={log.avg != null ? log.avg.toFixed(1) : "—"}
                sub={`prior ${LOG_WEEKS - 1} wks`}
              />
              <Stat
                size="sm"
                label="Last session"
                value={log.daysSince == null ? "—" : log.daysSince === 0 ? "Today" : log.daysSince}
                unit={log.daysSince != null && log.daysSince > 0 ? (log.daysSince === 1 ? "day ago" : "days ago") : undefined}
              />
            </div>
            <div className="mt-4">
              <BarChart
                bars={log.weekly}
                height={120}
                max={7}
                yFormat={(v) => `${v} ${v === 1 ? "session" : "sessions"}`}
                ariaLabel="Training sessions per week"
              />
            </div>
          </Card>

          {log.compare && (
            <Card padding="md">
              <h3 className="mb-3 text-callout font-semibold">
                Do you train on good days?
              </h3>
              <BeforeAfterBar
                label="Average readiness"
                before={log.compare.rest}
                after={log.compare.train}
                beforeLabel="Rest days"
                afterLabel="Training days"
                direction="neutral"
              />
            </Card>
          )}

          <ListGroup>
            {log.recent.map((s) => (
              <div key={s.key} className="flex min-h-[56px] items-center gap-3 px-4 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
                  <Icon name="dumbbell" size={16} strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-callout font-medium">{s.text}</span>
                  <span className="block text-caption text-[var(--muted)]">
                    {relDay(s.date, today)}
                    {s.source === "capture" ? " · logged by voice" : ""}
                  </span>
                </span>
              </div>
            ))}
          </ListGroup>
        </div>
      )}

      {/* ---- Practices in the stack ---- */}
      {practices.length > 0 && (
        <>
          <SectionHeader title="In your stack" eyebrow="Training & recovery" href="/stack" hrefLabel="Stack" />
          <ListGroup>
            {practices.slice(0, 8).map((p) => (
              <Link
                key={p.id}
                href={`/items/${p.id}`}
                className="flex min-h-[56px] items-center gap-3 px-4 py-2.5 active:bg-[var(--surface-alt)]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
                  <Icon name={p.item_type === "device" ? "battery" : "leaf"} size={16} strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-callout font-medium">{p.name}</span>
                  {(p.how_to || p.usage_notes) && (
                    <span className="block truncate text-caption text-[var(--muted)]">
                      {(p.how_to ?? p.usage_notes ?? "").split("\n")[0]}
                    </span>
                  )}
                </span>
                {p.timing_slot === "pre_workout" && <Chip size="sm">Pre-workout</Chip>}
                <Icon name="chevron-right" size={16} strokeWidth={2} className="shrink-0 text-[var(--muted)]" />
              </Link>
            ))}
          </ListGroup>
        </>
      )}
    </div>
  );
}
