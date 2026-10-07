// /recap — this week vs last week. Server-rendered from the same loader
// as /insights; every stat carries its comparison and n.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO } from "@/lib/series";
import { calcMacros, type ActivityLevel, type BodyGoal, type Sex } from "@/lib/macros";
import { fetchAllRows, loadInsightsData } from "@/lib/insights/load";
import { computeRecap, type IntakeRow, type RecapModel } from "@/lib/insights/recap";
import { computeHub } from "@/lib/insights/hub";
import type { Summary } from "@/lib/insights/stats";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { SectionHeader, Stat } from "@/components/ui/Section";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import { ButtonLink } from "@/components/ui/Button";
import MetricDelta from "@/components/MetricDelta";
import BarChart from "@/components/charts/BarChart";
import AskCoach from "@/components/insights/AskCoach";
import { fmtShortDate, moveLabel } from "@/components/insights/WorkingItemCard";

type Profile = {
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  biological_sex: Sex | null;
  activity_level: ActivityLevel | null;
  body_goal: BodyGoal | null;
  meals_per_day: number | null;
  postop_date: string | null;
  water_target_oz: number | null;
};

function weekday(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "long" });
}

// Request time (server component; not a render-purity concern).
function getNow(): number {
  return Date.now();
}

const r0 = (n: number | null | undefined) => (n == null ? null : Math.round(n));

function meanDelta(a: Summary, b: Summary): number | null {
  return a.mean != null && b.mean != null ? Math.round(a.mean - b.mean) : null;
}

export default async function RecapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/recap");

  const data = await loadInsightsData(supabase, user.id);
  const now = getNow();
  const from14 = addDaysISO(data.today, -14);
  const [intake, profRes, achRes] = await Promise.all([
    fetchAllRows<IntakeRow>(
      (a, b) =>
        supabase
          .from("intake_log")
          .select("date, kind, protein_g, water_oz")
          .gte("date", from14)
          .lte("date", data.today)
          .order("date")
          .order("logged_at")
          .range(a, b),
      "intake_log",
    ),
    supabase
      .from("profiles")
      .select(
        "weight_kg, height_cm, age, biological_sex, activity_level, body_goal, meals_per_day, postop_date, water_target_oz",
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("achievements")
      .select("achievement_key, unlocked_at")
      .gte("unlocked_at", new Date(now - 7 * 86400000).toISOString()),
  ]);

  const p = profRes.data as Profile | null;
  let proteinTarget: number | null = null;
  if (p?.weight_kg && p.height_cm && p.age && p.biological_sex) {
    const postOp =
      !!p.postop_date && new Date(p.postop_date).getTime() > now - 180 * 86400000;
    proteinTarget = calcMacros({
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

  const recap = computeRecap({
    data,
    intake,
    proteinTarget,
    waterTarget: p?.water_target_oz ?? null,
    items: data.items,
  });
  const hub = computeHub(data);
  const topSignal = hub.working.find((w) => w.best && w.verdict.tone === "good") ?? null;
  const reactionsThisWeek = data.reactions.filter((r) => r.reacted_on >= recap.thisWeek.from).length;
  const achievements = (achRes.data ?? []).length;

  const tw = recap.thisWeek;
  const lw = recap.lastWeek;
  const adhPct = tw.adherence.rate != null ? Math.round(tw.adherence.rate * 100) : null;
  const adhDelta =
    tw.adherence.rate != null && lw.adherence.rate != null
      ? Math.round((tw.adherence.rate - lw.adherence.rate) * 100)
      : null;

  if (tw.adherence.scheduled === 0 && tw.hrv.n === 0) {
    return (
      <div className="pb-24">
        <PageHeader eyebrow="This week" title="Weekly recap" />
        <Card padding="lg">
          <p className="text-callout text-[var(--foreground-soft)]">
            Nothing logged in the last 7 days yet. Check off a few doses and your
            week-over-week numbers show up here.
          </p>
          <ButtonLink href="/today" className="mt-4">
            Go to Today
          </ButtonLink>
        </Card>
      </div>
    );
  }

  const coachPrompt =
    `Review my week (${fmtShortDate(tw.from)}–${fmtShortDate(tw.to)}) vs the week before. ` +
    `Adherence ${adhPct ?? "—"}% (${adhDelta != null ? `${adhDelta >= 0 ? "+" : ""}${adhDelta}pp` : "no prior week"}), ` +
    `avg HRV ${r0(tw.hrv.mean) ?? "—"} ms vs ${r0(lw.hrv.mean) ?? "—"}, sleep score ${r0(tw.sleep.mean) ?? "—"} vs ${r0(lw.sleep.mean) ?? "—"}, ` +
    `readiness ${r0(tw.readiness.mean) ?? "—"} vs ${r0(lw.readiness.mean) ?? "—"}. ` +
    (recap.best ? `Best day ${weekday(recap.best.date)}, hardest ${recap.worst ? weekday(recap.worst.date) : "—"}. ` : "") +
    `What's the one thing to change next week? Be specific and honest about how little one week of data says.`;

  return (
    <div className="pb-24">
      <PageHeader
        eyebrow="This week"
        title="Weekly recap"
        subtitle={`Last 7 full days, ${fmtShortDate(tw.from)} – ${fmtShortDate(tw.to)}, vs the 7 before`}
      />

      <Card padding="lg">
        <Stat
          size="lg"
          label="Adherence"
          value={adhPct ?? "—"}
          unit={adhPct != null ? "%" : undefined}
          delta={
            adhDelta != null ? (
              <MetricDelta delta={adhDelta} unit="pp" baseline="vs last week" hideOnZero={false} />
            ) : undefined
          }
          sub={`${tw.adherence.taken} of ${tw.adherence.scheduled} scheduled doses`}
        />
        <div className="mt-4">
          <BarChart
            bars={recap.days.map((d) => ({
              x: d.date,
              y: d.adherence != null ? Math.round(d.adherence * 100) : null,
            }))}
            target={80}
            max={100}
            unit="%"
            decimals={0}
            height={120}
            ariaLabel="Daily adherence, last 7 days"
          />
        </div>
      </Card>

      <SectionHeader title="Recovery & habits" eyebrow="Weekly averages" />
      <Card padding="md">
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          <WeekStat label="HRV" a={tw.hrv} b={lw.hrv} unit="ms" direction="good_higher" />
          <WeekStat label="Sleep score" a={tw.sleep} b={lw.sleep} direction="good_higher" />
          <WeekStat label="Readiness" a={tw.readiness} b={lw.readiness} direction="good_higher" />
          {recap.proteinTarget != null ? (
            <Stat
              size="sm"
              label="Protein days"
              value={tw.proteinHitDays ?? 0}
              unit="/ 7"
              delta={
                lw.proteinHitDays != null ? (
                  <MetricDelta
                    delta={(tw.proteinHitDays ?? 0) - lw.proteinHitDays}
                    unit="d"
                    baseline="vs last wk"
                  />
                ) : undefined
              }
              sub={`≥${recap.proteinTarget} g · ${tw.loggedFoodDays} days logged`}
            />
          ) : (
            <Stat size="sm" label="Food logged" value={tw.loggedFoodDays} unit="days" sub="Set weight & age for a protein target" />
          )}
          <Stat
            size="sm"
            label="Water"
            value={tw.waterAvgOz != null ? Math.round(tw.waterAvgOz) : "—"}
            unit="oz/day"
            delta={
              tw.waterAvgOz != null && lw.waterAvgOz != null ? (
                <MetricDelta delta={Math.round(tw.waterAvgOz - lw.waterAvgOz)} unit=" oz" baseline="vs last wk" />
              ) : undefined
            }
            sub={`${tw.waterDays} days logged${recap.waterTarget ? ` · goal ${recap.waterTarget}` : ""}`}
          />
          <Stat
            size="sm"
            label="Stack spend"
            value={tw.spend != null ? `$${Math.round(tw.spend)}` : "—"}
            delta={
              tw.spend != null && lw.spend != null ? (
                <MetricDelta delta={Math.round(tw.spend - lw.spend)} direction="neutral" baseline="vs last wk" />
              ) : undefined
            }
            sub={
              tw.ordered.count > 0
                ? `doses taken · ${tw.ordered.count} order${tw.ordered.count === 1 ? "" : "s"} ($${Math.round(tw.ordered.cost)})`
                : "cost of doses taken"
            }
          />
        </div>
        <p className="mt-4 border-t border-[var(--border)] pt-3 text-caption text-[var(--muted)]">
          Oura nights: {tw.hrv.n} this week vs {lw.hrv.n} last. One week is noisy — the
          30-day view on Progress is steadier.
        </p>
      </Card>

      {(recap.best || recap.worst) && (
        <>
          <SectionHeader
            title="Best & hardest day"
            eyebrow={recap.rankBy === "readiness" ? "By next-morning readiness" : "By adherence"}
          />
          <ListGroup>
            {recap.best && (
              <ListRow
                icon="trend-up"
                iconTone="success"
                title={weekday(recap.best.date)}
                subtitle={dayLine(recap.best)}
                trailing={recap.best.readiness != null ? `${recap.best.readiness}` : undefined}
              />
            )}
            {recap.worst && (
              <ListRow
                icon="trend-down"
                iconTone="warn"
                title={weekday(recap.worst.date)}
                subtitle={dayLine(recap.worst)}
                trailing={recap.worst.readiness != null ? `${recap.worst.readiness}` : undefined}
              />
            )}
          </ListGroup>
        </>
      )}

      <SectionHeader title="What moved" />
      <ListGroup>
        {topSignal?.best && (
          <ListRow
            href="/insights"
            icon="graph"
            iconTone="success"
            title={`${topSignal.name}`}
            subtitle={`Strongest signal · ${moveLabel(topSignal.best)}`}
          />
        )}
        {recap.mostImproved && (
          <ListRow
            href={`/items/${recap.mostImproved.id}`}
            icon="arrow-up"
            iconTone="success"
            title={recap.mostImproved.name}
            subtitle={`Most improved consistency · ${pct(recap.mostImproved.from)} → ${pct(recap.mostImproved.to)}`}
          />
        )}
        {recap.slipping && (
          <ListRow
            href={`/items/${recap.slipping.id}`}
            icon="arrow-down"
            iconTone="warn"
            title={recap.slipping.name}
            subtitle={`Slipping · ${pct(recap.slipping.from)} → ${pct(recap.slipping.to)}`}
          />
        )}
        {recap.started.map((s) => (
          <ListRow
            key={`s-${s.id}`}
            href={`/items/${s.id}`}
            icon="plus"
            title={s.name}
            subtitle={`Started ${weekday(s.date)}`}
          />
        ))}
        {recap.stopped.map((s) => (
          <ListRow
            key={`x-${s.id}`}
            href={`/items/${s.id}`}
            icon="minus"
            title={s.name}
            subtitle={`Stopped ${weekday(s.date)}`}
          />
        ))}
        {!topSignal && !recap.mostImproved && !recap.slipping && recap.started.length === 0 && recap.stopped.length === 0 && (
          <ListRow title="A steady week" subtitle="No items started, stopped, or swung ±15% in consistency." />
        )}
      </ListGroup>
      <p className="mt-2 px-1 text-caption text-[var(--muted)]">
        {reactionsThisWeek} reaction{reactionsThisWeek === 1 ? "" : "s"} logged ·{" "}
        <Link href="/achievements" className="underline underline-offset-2">
          {achievements} achievement{achievements === 1 ? "" : "s"} unlocked
        </Link>{" "}
        this week
      </p>

      <div className="mt-6">
        <AskCoach prompt={coachPrompt} label="Review my week with Coach" fullWidth />
      </div>
    </div>
  );
}

function pct(r: number) {
  return `${Math.round(r * 100)}%`;
}

function dayLine(d: RecapModel["days"][number]) {
  const parts = [
    d.adherence != null ? `${pct(d.adherence)} of doses` : "nothing scheduled",
    d.readiness != null ? `readiness ${d.readiness} next morning` : null,
    d.sleep != null ? `sleep ${d.sleep}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function WeekStat({
  label,
  a,
  b,
  unit,
  direction,
}: {
  label: string;
  a: Summary;
  b: Summary;
  unit?: string;
  direction: "good_higher" | "good_lower";
}) {
  const d = meanDelta(a, b);
  return (
    <Stat
      size="sm"
      label={label}
      value={a.mean != null ? Math.round(a.mean) : "—"}
      unit={unit}
      delta={
        d != null ? (
          <MetricDelta delta={d} unit={unit ? ` ${unit}` : undefined} direction={direction} baseline="vs last wk" />
        ) : undefined
      }
      sub={`n=${a.n} vs ${b.n}`}
    />
  );
}
