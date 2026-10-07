// "Your data" block on /items/[id]: days on, adherence, cost per dose,
// supply runway, 13-week heatmap, and the "since starting" set.
// Server-safe.

import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import { Stat } from "@/components/ui/Section";
import BeforeAfterBar from "@/components/charts/BeforeAfterBar";
import CalendarHeatmap from "@/components/charts/CalendarHeatmap";
import Icon from "@/components/Icon";
import { daysBetween } from "@/lib/series";
import type { ItemInsights } from "@/lib/insights/item";
import { VERDICT_CHIP, fmtShortDate } from "@/components/insights/WorkingItemCard";

function usd(n: number) {
  return n < 10 ? `$${n.toFixed(2)}` : `$${Math.round(n)}`;
}

export default function ItemDataSection({
  data,
  today,
  itemName,
}: {
  data: ItemInsights;
  today: string;
  itemName: string;
}) {
  const a = data.adherence;
  const usable = data.metrics.filter((m) => m.result.confidence !== "insufficient");
  const chip = data.verdict ? VERDICT_CHIP[data.verdict.kind] : null;
  const supply = data.supply;
  const supplyUrgent = supply != null && supply.reorderBy <= today;

  return (
    <section className="mb-6">
      <Card padding="md">
        <div className="grid grid-cols-3 gap-3">
          <Stat
            size="sm"
            label="On it"
            value={data.daysOn != null ? data.daysOn : "—"}
            unit={data.daysOn != null ? (data.daysOn === 1 ? "day" : "days") : undefined}
            sub={data.startedOn ? `since ${fmtShortDate(data.startedOn)}` : "no start date"}
          />
          <Stat
            size="sm"
            label="Adherence"
            value={a?.rate != null ? Math.round(a.rate * 100) : "—"}
            unit={a?.rate != null ? "%" : undefined}
            sub={a ? `${a.taken} of ${Math.round(a.scheduled)} doses` : "not scheduled"}
          />
          <Stat
            size="sm"
            label="Per dose"
            value={data.costPerDose != null ? usd(data.costPerDose) : "—"}
            sub={
              data.monthlyAtAdherence != null
                ? `~${usd(data.monthlyAtAdherence)}/mo as taken`
                : data.costPerDose == null
                  ? "add cost + supply"
                  : undefined
            }
          />
        </div>

        {supply && (
          <div
            className={`mt-4 flex items-start gap-2.5 rounded-[14px] px-3 py-2.5 ${supplyUrgent ? "bg-[var(--warn-tint)]" : "bg-[var(--surface-alt)]"}`}
          >
            <Icon
              name="clock"
              size={16}
              strokeWidth={1.9}
              className={`mt-0.5 shrink-0 ${supplyUrgent ? "text-[var(--warn)]" : "text-[var(--muted)]"}`}
            />
            <div className="min-w-0">
              <div className="text-footnote font-medium">
                {supply.daysLeft <= 0
                  ? "Likely out now"
                  : `Runs out ~${fmtShortDate(supply.runsOutOn)} · reorder by ${fmtShortDate(supply.reorderBy)}`}
              </div>
              <div className="text-caption text-[var(--muted)]">
                ~{supply.remaining} doses left at {Math.round(supply.perDay * 30)} doses/30 days
                {supply.basis === "estimated"
                  ? " · estimated from your start date (set an arrival date for accuracy)"
                  : " · counted from arrival"}
              </div>
            </div>
          </div>
        )}

        {a && (
          <div className="mt-4">
            <CalendarHeatmap
              days={data.heatmap}
              weeks={13}
              today={today}
              hideLegend
              ariaLabel={`${itemName} doses, last 13 weeks`}
            />
            <p className="mt-1.5 text-caption text-[var(--muted)]">
              Filled = taken · dim = due but not taken · last 13 weeks
            </p>
          </div>
        )}
      </Card>

      <div className="mt-6 mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-eyebrow uppercase text-[var(--muted)]">Since starting</div>
          <h2 className="mt-1 text-title-3">Your numbers</h2>
        </div>
        {chip && usable.length > 0 && (
          <Chip size="sm" tone={chip.tone}>
            {chip.label}
          </Chip>
        )}
      </div>
      <Card padding="md">
        {data.verdict && (usable.length > 0 || data.verdict.sentiment !== "none") && (
          <div className="mb-4 border-b border-[var(--border)] pb-3">
            <p className="text-callout font-medium">{data.verdict.headline}</p>
            <p className="mt-0.5 text-caption text-[var(--muted)]">{data.verdict.detail}</p>
          </div>
        )}
        {data.metrics.length > 0 && usable.length > 0 ? (
          <div className="flex flex-col gap-5">
            {data.metrics.map((m) =>
              m.result.before.mean != null && m.result.after.mean != null ? (
                <div key={m.metric}>
                  <BeforeAfterBar
                    label={m.metric === "mood" ? "Mood (1–5)" : m.label}
                    before={{ mean: m.result.before.mean, n: m.result.before.n }}
                    after={{ mean: m.result.after.mean, n: m.result.after.n }}
                    unit={m.unit && !m.unit.startsWith("/") ? m.unit : undefined}
                    direction={
                      m.result.outcome === "flat" || m.result.confidence === "weak"
                        ? "neutral"
                        : m.direction
                    }
                    afterLabel="Since"
                  />
                  <p className="mt-1 text-caption text-[var(--muted)]">
                    {m.result.confidenceLabel}
                  </p>
                </div>
              ) : null,
            )}
            {usable[0] && data.startedOn && (
              <p className="text-caption text-[var(--muted)]">
                4 weeks before ({fmtShortDate(usable[0].result.before.from)}–
                {fmtShortDate(usable[0].result.before.to)}) vs days 8–
                {daysBetween(data.startedOn, usable[0].result.after.to) + 1} after starting. Shows
                association only — other changes in the same weeks move these numbers too.
              </p>
            )}
          </div>
        ) : (
          <p className="text-footnote text-[var(--muted)]">
            {data.metricsNote ?? "Not enough readings around the start date yet."}
          </p>
        )}
      </Card>
    </section>
  );
}
