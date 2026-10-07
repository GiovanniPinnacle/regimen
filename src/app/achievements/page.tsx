// /achievements — every badge, with real progress toward the locked
// ones ("4 of 7 days"). Server-rendered; reads the same signals the
// unlock API (/api/achievements) evaluates.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, computeStreak } from "@/lib/series";
import { getUserToday } from "@/lib/user-date";
import { fetchAllRows } from "@/lib/insights/load";
import {
  ACHIEVEMENTS,
  type Achievement,
  type AchievementMetric,
} from "@/lib/achievements";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/Section";
import { ListGroup } from "@/components/ui/ListRow";
import MetricRing from "@/components/MetricRing";
import Icon from "@/components/Icon";
import { fmtShortDate } from "@/components/insights/WorkingItemCard";

type Tier = Achievement["tier"];
const TIERS: { tier: Tier; title: string; desc: string }[] = [
  { tier: "starter", title: "Starter", desc: "Day-one unlocks" },
  { tier: "milestone", title: "Milestone", desc: "Earned through real use" },
  { tier: "legendary", title: "Legendary", desc: "Rare — most people never get here" },
];

type Progress = { current: number; target: number; pct: number } | null;

export default async function AchievementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/achievements");
  const uid = user.id;
  const { today } = await getUserToday(supabase, uid);
  const since = addDaysISO(today, -200);

  const count = (res: { count: number | null }) => res.count ?? 0;
  const [
    unlockedRes,
    streakLogs,
    checkoffsRes,
    skipsRes,
    reactionsRes,
    memosRes,
    mealsRes,
    photoRes,
    protocolsRes,
    refinesRes,
    retiredRes,
  ] = await Promise.all([
    supabase.from("achievements").select("achievement_key, unlocked_at").eq("user_id", uid),
    fetchAllRows<{ date: string; taken: boolean | null }>(
      (a, b) =>
        supabase
          .from("stack_log")
          .select("date, taken")
          .eq("user_id", uid)
          .eq("taken", true)
          .gte("date", since)
          .order("date", { ascending: false })
          .range(a, b),
      "achievements stack_log",
      10,
    ),
    supabase.from("stack_log").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("taken", true),
    supabase
      .from("stack_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("taken", false)
      .not("skipped_reason", "is", null),
    supabase.from("item_reactions").select("id", { count: "exact", head: true }).eq("user_id", uid),
    supabase.from("voice_memos").select("id", { count: "exact", head: true }).eq("user_id", uid),
    supabase
      .from("intake_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .in("kind", ["meal", "snack"]),
    supabase
      .from("intake_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .in("kind", ["meal", "snack"])
      .not("photo_url", "is", null),
    supabase.from("protocol_enrollments").select("id", { count: "exact", head: true }).eq("user_id", uid),
    supabase
      .from("changelog")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("change_type", "refinement_run"),
    supabase
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("status", "retired"),
  ]);

  const metrics: Record<AchievementMetric, number> = {
    checkoffs: count(checkoffsRes),
    skips_with_reason: count(skipsRes),
    reactions: count(reactionsRes),
    voice_memos: count(memosRes),
    meals: count(mealsRes),
    photo_meals: count(photoRes),
    protocols: count(protocolsRes),
    refinements: count(refinesRes),
    streak: computeStreak(streakLogs, today),
    retired: count(retiredRes),
  };
  const unlockedAt = new Map<string, string>(
    ((unlockedRes.data ?? []) as { achievement_key: string; unlocked_at: string }[]).map((r) => [
      r.achievement_key,
      r.unlocked_at,
    ]),
  );

  const progressOf = (a: Achievement): Progress => {
    if (!a.goal) return null;
    const current = Math.min(metrics[a.goal.metric], a.goal.target);
    return { current, target: a.goal.target, pct: current / a.goal.target };
  };
  // A badge earned but not yet recorded (the unlock API runs from
  // Today) still shows as earned here.
  const isUnlocked = (a: Achievement) => unlockedAt.has(a.key) || (progressOf(a)?.pct ?? 0) >= 1;

  const unlockedCount = ACHIEVEMENTS.filter(isUnlocked).length;
  const total = ACHIEVEMENTS.length;
  const upNext = ACHIEVEMENTS.filter((a) => !isUnlocked(a) && a.goal && (progressOf(a)?.pct ?? 0) > 0)
    .sort((a, b) => (progressOf(b)?.pct ?? 0) - (progressOf(a)?.pct ?? 0))
    .slice(0, 3);
  const lastUnlock = [...unlockedAt.entries()].sort((a, b) => (a[1] < b[1] ? 1 : -1))[0];
  const lastBadge = lastUnlock ? ACHIEVEMENTS.find((a) => a.key === lastUnlock[0]) : null;

  return (
    <div className="pb-24">
      <PageHeader
        back="/you"
        backLabel="You"
        title="Achievements"
        subtitle={`${unlockedCount} of ${total} unlocked`}
      />

      <Card padding="lg" className="flex items-center gap-4">
        <MetricRing
          value={unlockedCount}
          max={total}
          size={72}
          color="var(--success)"
          trackColor="var(--surface-alt)"
          ariaLabel={`${unlockedCount} of ${total} unlocked`}
        >
          <span className="text-callout font-bold tabular-nums">
            {Math.round((unlockedCount / total) * 100)}%
          </span>
        </MetricRing>
        <div className="min-w-0">
          <div className="text-title-2 tabular-nums">
            {unlockedCount}
            <span className="text-[var(--muted)] font-normal"> / {total}</span>
          </div>
          <div className="text-footnote text-[var(--muted)]">
            Current streak {metrics.streak} day{metrics.streak === 1 ? "" : "s"} ·{" "}
            {metrics.checkoffs.toLocaleString("en-US")} check-offs
          </div>
          {lastBadge && lastUnlock && (
            <div className="mt-0.5 truncate text-caption text-[var(--muted)]">
              Latest: {lastBadge.title} · {fmtShortDate(lastUnlock[1].slice(0, 10))}
            </div>
          )}
        </div>
      </Card>

      {upNext.length > 0 && (
        <>
          <SectionHeader title="Up next" eyebrow="Closest to unlocking" />
          <ListGroup>
            {upNext.map((a) => {
              const p = progressOf(a)!;
              return (
                <div key={a.key} className="flex min-h-[64px] items-center gap-3 px-4 py-3">
                  <BadgeIcon a={a} unlocked={false} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-body font-medium">{a.title}</span>
                      <span className="shrink-0 text-caption tabular-nums text-[var(--muted)]">
                        {p.current} / {p.target} {a.goal!.unit}
                      </span>
                    </div>
                    <ProgressBar pct={p.pct} />
                  </div>
                </div>
              );
            })}
          </ListGroup>
        </>
      )}

      {TIERS.map(({ tier, title, desc }) => {
        const list = ACHIEVEMENTS.filter((a) => a.tier === tier);
        const got = list.filter(isUnlocked).length;
        return (
          <section key={tier}>
            <SectionHeader
              eyebrow={desc}
              title={title}
              action={
                <span className="text-footnote tabular-nums text-[var(--muted)]">
                  {got}/{list.length}
                </span>
              }
            />
            <div className="grid grid-cols-2 gap-2">
              {list.map((a) => (
                <BadgeCard
                  key={a.key}
                  a={a}
                  unlocked={isUnlocked(a)}
                  unlockedOn={unlockedAt.get(a.key)?.slice(0, 10) ?? null}
                  progress={progressOf(a)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function BadgeIcon({ a, unlocked, size = 44 }: { a: Achievement; unlocked: boolean; size?: number }) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center rounded-full ${
        unlocked
          ? "bg-[var(--success-tint)] text-[var(--success)] border border-[rgba(52,194,142,0.28)]"
          : "bg-[var(--surface-alt)] text-[var(--muted)] border border-[var(--border)]"
      }`}
      style={{ width: size, height: size }}
    >
      <Icon name={a.glyph} size={Math.round(size * 0.46)} strokeWidth={1.8} />
      {!unlocked && (
        <span className="absolute -right-0.5 -bottom-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]">
          <Icon name="lock" size={10} strokeWidth={2} />
        </span>
      )}
    </span>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div
      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-alt)]"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct * 100)}
    >
      <div
        className="h-full rounded-full bg-[var(--foreground)] opacity-80"
        style={{ width: `${Math.max(4, pct * 100)}%` }}
      />
    </div>
  );
}

function BadgeCard({
  a,
  unlocked,
  unlockedOn,
  progress,
}: {
  a: Achievement;
  unlocked: boolean;
  unlockedOn: string | null;
  progress: Progress;
}) {
  return (
    <div
      className={`flex flex-col rounded-[20px] border p-3.5 ${
        unlocked
          ? "border-[var(--border)] bg-[var(--surface)]"
          : "border-[var(--border)] bg-transparent"
      }`}
    >
      <BadgeIcon a={a} unlocked={unlocked} />
      <div className={`mt-2.5 text-footnote font-semibold ${unlocked ? "" : "text-[var(--foreground-soft)]"}`}>
        {a.title}
      </div>
      <div className="mt-0.5 line-clamp-3 text-caption text-[var(--muted)]">{a.detail}</div>
      <div className="mt-auto pt-2.5">
        {unlocked ? (
          <span className="inline-flex items-center gap-1 text-caption font-medium text-[var(--success)]">
            <Icon name="check" size={12} strokeWidth={2.4} />
            {unlockedOn ? fmtShortDate(unlockedOn) : "Earned"}
          </span>
        ) : progress && progress.target > 1 ? (
          <>
            <div className="text-caption tabular-nums text-[var(--muted)]">
              {progress.current} / {progress.target} {a.goal!.unit}
            </div>
            <ProgressBar pct={progress.pct} />
          </>
        ) : (
          <span className="text-caption text-[var(--muted)]">Not yet</span>
        )}
      </div>
    </div>
  );
}
