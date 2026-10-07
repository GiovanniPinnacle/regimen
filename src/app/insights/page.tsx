// /insights — Progress: "what's actually working?"
//
// Server component. One parallel load (src/lib/insights/load.ts), pure
// computation (src/lib/insights/hub.ts), then plain props into the chart
// kit. Every number shows its n and date range; every comparison is
// framed as association ("since starting"), never causation.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadInsightsData } from "@/lib/insights/load";
import { computeHub, type HubModel } from "@/lib/insights/hub";
import { METRICS } from "@/lib/insights/metrics";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { SectionHeader, Stat } from "@/components/ui/Section";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import { ButtonLink } from "@/components/ui/Button";
import MetricDelta from "@/components/MetricDelta";
import CalendarHeatmap from "@/components/charts/CalendarHeatmap";
import ScatterPlot from "@/components/charts/ScatterPlot";
import BarList from "@/components/charts/BarList";
import TrendExplorer from "@/components/insights/TrendExplorer";
import CoachLenses from "@/components/insights/CoachLenses";
import AuditCard from "@/components/insights/AuditCard";
import WorkingItemCard, { fmtShortDate } from "@/components/insights/WorkingItemCard";
import PatternCard from "@/components/PatternCard";

const pct = (r: number | null) => (r == null ? "—" : String(Math.round(r * 100)));

function round(n: number | null | undefined, d = 0): number {
  if (n == null) return 0;
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export default async function InsightsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/insights");

  const data = await loadInsightsData(supabase, user.id);
  const hub = computeHub(data);
  const rangeFrom = hub.hero.hrv.current.from;

  return (
    <div className="pb-24">
      <PageHeader
        eyebrow="Progress"
        title="What's working"
        subtitle={`Last 30 days vs the 30 before · ${fmtShortDate(rangeFrom)} – ${fmtShortDate(hub.today)}`}
      />

      <Hero hub={hub} />

      <SectionHeader
        eyebrow="Since starting"
        title="Your stack, by the numbers"
        className="!mt-7"
      />
      {hub.working.length === 0 ? (
        <Card padding="lg">
          <p className="text-callout text-[var(--foreground-soft)]">
            Nothing to compare yet. Once an item has a week of wearable data on
            both sides of its start date, it shows up here with a before/after read.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {hub.working.slice(0, 6).map((w) => (
            <WorkingItemCard key={w.id} w={w} />
          ))}
        </div>
      )}
      {hub.tooEarly.length > 0 && (
        <p className="mt-3 px-1 text-caption text-[var(--muted)]">
          {tooEarlyText(hub)}
        </p>
      )}
      <p className="mt-2 px-1 text-caption text-[var(--muted)]">
        Compares 28 days before each start date with the period after a 7-day
        settle-in. Association, not proof — sleep, stress and other changes move
        these numbers too.
      </p>

      <SectionHeader eyebrow="Oura" title="Recovery trends" />
      <Card padding="md">
        {hub.hasOura ? (
          <TrendExplorer trends={hub.trends} markers={hub.markers} today={hub.today} />
        ) : (
          <div className="py-6 text-center">
            <p className="text-callout text-[var(--foreground-soft)]">
              Connect Oura to see HRV, resting heart rate and sleep trends against
              your own baseline.
            </p>
            <ButtonLink href="/you" variant="secondary" size="sm" className="mt-3">
              Connect Oura
            </ButtonLink>
          </div>
        )}
      </Card>

      <Consistency hub={hub} />

      <Skips hub={hub} />

      <SectionHeader eyebrow="Coach" title="Dig deeper" />
      <CoachLenses />
      <div className="mt-4">
        <AuditCard reactionsTotal={data.reactions.length} />
      </div>

      <SectionHeader title="Flags to act on" />
      <PatternCard />

      <SectionHeader title="More" />
      <ListGroup>
        <ListRow href="/tests" icon="test-tube" title="Labs" subtitle="Biomarkers vs reference range" />
        <ListRow href="/recap" icon="calendar" title="Weekly recap" subtitle="This week vs last" />
        <ListRow href="/costs" icon="dollar" title="Costs" subtitle="Run-rate and cost per dose" />
        <ListRow href="/achievements" icon="award" title="Achievements" subtitle="Badges and progress" />
      </ListGroup>
    </div>
  );
}

function tooEarlyText(hub: HubModel): string {
  const t = hub.tooEarly;
  const names = t
    .slice(0, 2)
    .map((x) => x.name.replace(/\s+[—–-].*$/, ""))
    .join(", ");
  const more = t.length > 2 ? ` +${t.length - 2}` : "";
  const first = t.map((x) => x.readyOn).sort()[0];
  return `${t.length} recent start${t.length === 1 ? "" : "s"} (${names}${more}) need a couple more weeks of data — first reads from ${fmtShortDate(first)}.`;
}

function Hero({ hub }: { hub: HubModel }) {
  const a = hub.hero.adherence;
  const adhDelta =
    a.current != null && a.prior != null ? Math.round((a.current - a.prior) * 100) : null;
  const hrv = hub.hero.hrv;
  const sleep = hub.hero.sleep;
  const sleepDef = METRICS[hub.hero.sleepMetric];
  return (
    <Card padding="lg">
      <div className="grid grid-cols-3 gap-3">
        <Stat
          label="Adherence"
          value={pct(a.current)}
          unit="%"
          delta={
            adhDelta != null ? (
              <MetricDelta delta={adhDelta} unit="pp" direction="good_higher" />
            ) : undefined
          }
        />
        <Stat
          label="HRV"
          value={hrv.current.mean != null ? Math.round(hrv.current.mean) : "—"}
          unit="ms"
          delta={
            hrv.delta != null && hrv.prior.n > 0 ? (
              <MetricDelta delta={round(hrv.delta)} unit=" ms" direction="good_higher" />
            ) : undefined
          }
        />
        <Stat
          label={sleepDef.short === "Sleep" ? "Sleep score" : sleepDef.label}
          value={sleep.current.mean != null ? Math.round(sleep.current.mean) : "—"}
          delta={
            sleep.delta != null && sleep.prior.n > 0 ? (
              <MetricDelta delta={round(sleep.delta)} direction={sleepDef.direction} />
            ) : undefined
          }
        />
      </div>
      <p className="mt-3 border-t border-[var(--border)] pt-3 text-caption text-[var(--muted)]">
        30-day averages vs prior 30 days · {a.scheduled > 0 ? `${Math.round(a.scheduled)} scheduled doses` : "no doses scheduled"}
        {" · "}HRV n={hrv.current.n} vs {hrv.prior.n} nights
        {hrv.confidence !== "insufficient" ? ` · ${hrv.confidenceLabel.split(" · ")[0].toLowerCase()}` : ""}
      </p>
    </Card>
  );
}

function Consistency({ hub }: { hub: HubModel }) {
  const adh = hub.adherence;
  const rated = adh.weekday.filter((w) => w.rate != null) as { label: string; rate: number }[];
  const best = [...rated].sort((a, b) => b.rate - a.rate)[0];
  const worst = [...rated].sort((a, b) => a.rate - b.rate)[0];
  const s = adh.split;
  const showSplit = s.high.n > 0 && s.low.n > 0 && s.high.mean != null && s.low.mean != null;
  return (
    <>
      <SectionHeader eyebrow="Adherence" title="Consistency" />
      <Card padding="md">
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Stat size="sm" label="Last 30 days" value={pct(adh.last30)} unit="%" />
          <Stat size="sm" label="Best day" value={best ? best.label : "—"} sub={best ? `${pct(best.rate)}%` : undefined} />
          <Stat size="sm" label="Hardest day" value={worst ? worst.label : "—"} sub={worst ? `${pct(worst.rate)}%` : undefined} />
        </div>
        <CalendarHeatmap
          days={adh.heatmap}
          weeks={13}
          today={hub.today}
          ariaLabel="Daily adherence, last 13 weeks"
        />
        <p className="mt-2 text-caption text-[var(--muted)]">
          Share of scheduled doses taken each day · weekday rates over the last 8 weeks.
        </p>
      </Card>

      <Card padding="md" className="mt-3">
        <h3 className="text-body font-semibold">Does consistency show up in readiness?</h3>
        <p className="mt-0.5 mb-3 text-footnote text-[var(--muted)]">
          Each dot is a day: doses taken vs next morning&apos;s Oura readiness.
        </p>
        <ScatterPlot
          points={adh.scatter}
          xLabel="Adherence"
          yLabel="Next-day readiness"
          xUnit="%"
          trendline
          height={190}
          minPoints={7}
          ariaLabel="Adherence versus next-day readiness"
        />
        {showSplit ? (
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-3">
            <Stat
              size="sm"
              label={`After ≥${Math.round(s.thresholds.high * 100)}% days`}
              value={Math.round(s.high.mean as number)}
              sub={`n=${s.high.n}`}
              delta={
                s.delta != null ? (
                  <MetricDelta
                    delta={round(s.delta)}
                    direction={s.confidence === "insufficient" || s.confidence === "weak" ? "neutral" : "good_higher"}
                    baseline="vs low days"
                  />
                ) : undefined
              }
            />
            <Stat
              size="sm"
              label={`After <${Math.round(s.thresholds.low * 100)}% days`}
              value={Math.round(s.low.mean as number)}
              sub={`n=${s.low.n}`}
            />
            <p className="col-span-2 text-caption text-[var(--muted)]">
              {s.confidence === "insufficient"
                ? `Only ${s.low.n} low-adherence day${s.low.n === 1 ? "" : "s"} with a reading the next morning — too few to compare. Good problem to have.`
                : `${s.confidenceLabel}. Associated, not proven — rough days tend to hurt both adherence and sleep.`}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-caption text-[var(--muted)]">
            Needs days on both sides (≥80% and &lt;50% adherence) with an Oura
            reading the next morning.
          </p>
        )}
      </Card>
    </>
  );
}

function Skips({ hub }: { hub: HubModel }) {
  const sk = hub.skips;
  if (sk.totalLogged === 0) return null;
  const given = sk.reasons.filter((r) => r.label !== "No reason given");
  const reasonRows = given.slice(0, 6).map((r) => ({
    label: r.label,
    value: r.count,
    sub: `${Math.round((r.count / Math.max(1, sk.withReason)) * 100)}% of explained skips`,
  }));
  const timeRows = sk.byTimeOfDay
    .filter((b) => b.logged > 0)
    .map((b) => ({
      label: b.label,
      value: Math.round((b.rate ?? 0) * 100),
      sub: `${b.skipped}/${b.logged}`,
      tone: (sk.worstTime?.label === b.label ? "warn" : "neutral") as "warn" | "neutral",
    }));
  return (
    <>
      <SectionHeader eyebrow="Skips" title="Why doses get missed" />
      <Card padding="md">
        <p className="mb-3 text-footnote text-[var(--muted)]">
          {`${sk.totalSkipped} skipped of ${sk.totalLogged} logged doses (${Math.round((sk.totalSkipped / sk.totalLogged) * 100)}%) · ${sk.withReason} with a reason · ${fmtShortDate(sk.from)} – ${fmtShortDate(hub.today)}`}
        </p>
        <BarList rows={reasonRows} ariaLabel="Skip reasons" emptyLabel="No skips logged" />
        {timeRows.length > 0 && (
          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <h3 className="mb-1 text-body font-semibold">Skip rate by time of day</h3>
            <p className="mb-3 text-caption text-[var(--muted)]">
              {sk.worstTime
                ? `${sk.worstTime.label} doses are skipped most (${Math.round((sk.worstTime.rate ?? 0) * 100)}%).`
                : "No time of day stands out yet."}
              {sk.worstWeekday ? ` ${sk.worstWeekday.label} is the hardest weekday.` : ""}
            </p>
            <BarList rows={timeRows} unit="%" decimals={0} max={100} ariaLabel="Skip rate by time of day" />
          </div>
        )}
      </Card>
    </>
  );
}
