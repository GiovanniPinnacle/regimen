// One item in the "What's working" list: verdict (taps vs numbers), the
// best-moving metric as a before/after bar, and honest caveats.
// Server-safe — no hooks, no function props into client charts.

import Link from "next/link";
import BeforeAfterBar from "@/components/charts/BeforeAfterBar";
import Chip, { type ChipTone } from "@/components/ui/Chip";
import Icon from "@/components/Icon";
import { daysBetween } from "@/lib/series";
import { cardClass } from "@/components/ui/Card";
import { shortItemName as shortName, type MetricMove, type WorkingItem } from "@/lib/insights/hub";

export const VERDICT_CHIP: Record<
  WorkingItem["verdict"]["kind"],
  { label: string; tone: ChipTone }
> = {
  agree_good: { label: "Working", tone: "success" },
  numbers_only: { label: "Numbers up", tone: "success" },
  feels_only: { label: "Feels better", tone: "neutral" },
  mismatch: { label: "Mixed signals", tone: "warn" },
  agree_flat: { label: "No clear effect", tone: "neutral" },
  numbers_worse: { label: "Wrong direction", tone: "warn" },
  not_enough: { label: "Too early", tone: "neutral" },
};

const METRICS_LABEL: Record<string, string> = {
  hrv: "HRV",
  rhr: "Resting heart rate",
  deep_sleep: "Deep sleep",
  sleep_score: "Sleep score",
  readiness: "Readiness",
  mood: "Mood (1–5)",
};

export function fmtShortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Unit as BeforeAfterBar expects it ("/5" mood reads better unitless). */
export function barUnit(m: Pick<MetricMove, "unit">): string | undefined {
  if (!m.unit || m.unit.startsWith("/")) return undefined;
  return m.unit;
}

export function moveLabel(m: MetricMove): string {
  const d = m.result.delta ?? 0;
  const v = m.decimals > 0 ? Math.abs(d).toFixed(m.decimals) : String(Math.round(Math.abs(d)));
  const u = barUnit(m);
  return `${m.short} ${d >= 0 ? "+" : "−"}${v}${u ? ` ${u}` : ""}`;
}

export default function WorkingItemCard({ w }: { w: WorkingItem }) {
  const early = w.best?.result.confidence === "early";
  const chip =
    w.sharedWithEarlier && (w.verdict.kind === "agree_good" || w.verdict.kind === "numbers_only")
      ? { label: "Shared signal", tone: "neutral" as ChipTone }
      : early && w.verdict.kind !== "agree_flat"
        ? { label: "Early read", tone: "neutral" as ChipTone }
        : VERDICT_CHIP[w.verdict.kind];
  const best = w.best;
  return (
    <article className={cardClass({ padding: "md" })}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/items/${w.id}`}
            className="-my-2 inline-flex min-h-[44px] max-w-full items-center gap-1"
          >
            <span className="truncate text-body font-semibold">{w.name}</span>
            <Icon name="chevron-right" size={14} strokeWidth={2} className="shrink-0 text-[var(--muted)]" />
          </Link>
          <div className="text-caption text-[var(--muted)]">
            Started {fmtShortDate(w.startedOn)} · day {w.daysOn}
            {w.reactionsTotal > 0 ? ` · ${w.reactionsTotal} tap${w.reactionsTotal === 1 ? "" : "s"}` : ""}
          </div>
        </div>
        <Chip tone={chip.tone} size="sm" className="mt-1 shrink-0">
          {chip.label}
        </Chip>
      </div>

      <p className="mt-2 text-callout font-medium">{w.verdict.headline}</p>

      {best && best.result.before.mean != null && best.result.after.mean != null && (
        <div className="mt-3">
          <BeforeAfterBar
            label={METRICS_LABEL[best.metric] ?? best.short}
            before={{ mean: best.result.before.mean, n: best.result.before.n }}
            after={{ mean: best.result.after.mean, n: best.result.after.n }}
            unit={barUnit(best)}
            direction={best.result.outcome === "flat" ? "neutral" : best.direction}
            beforeLabel="Before"
            afterLabel="Since"
          />
          <p className="mt-1.5 text-caption text-[var(--muted)]">
            4 weeks before vs days 8–{daysBetween(w.startedOn, best.result.after.to) + 1} after
            starting · {best.result.confidenceLabel.toLowerCase()}
          </p>
        </div>
      )}

      {w.alsoMoved.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {w.alsoMoved.map((m) => (
            <Chip
              key={m.metric}
              size="sm"
              tone={m.result.outcome === "better" ? "success" : "warn"}
            >
              {moveLabel(m)}
            </Chip>
          ))}
        </div>
      )}

      <p className="mt-2 text-caption text-[var(--muted)]">
        {w.verdict.detail}
        {w.overlapping.length > 0 &&
          ` ${w.overlapping.slice(0, 2).map(shortName).join(" and ")}${w.overlapping.length > 2 ? ` +${w.overlapping.length - 2}` : ""} started within 3 weeks and ${w.overlapping.length === 1 ? "shows" : "show"} the same ${w.best?.short ?? ""} move — the data can't separate them.`}
      </p>
    </article>
  );
}
