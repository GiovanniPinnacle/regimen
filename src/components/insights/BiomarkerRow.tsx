// One biomarker row on /tests: latest value, range, trend, change vs
// the previous draw coloured by whether it moved the right way.

import Link from "next/link";
import Icon from "@/components/Icon";
import Sparkline from "@/components/Sparkline";
import MetricDelta from "@/components/MetricDelta";
import Chip, { type ChipTone } from "@/components/ui/Chip";
import type { BiomarkerTrajectory } from "@/lib/insights/biomarkers";

export function statusChip(t: Pick<BiomarkerTrajectory, "status" | "side">): {
  label: string;
  tone: ChipTone;
} | null {
  if (t.status === "out") return { label: t.side === "low" ? "Low" : "High", tone: "danger" };
  if (t.status === "near")
    return { label: t.side === "low" ? "Low-normal" : "High-normal", tone: "warn" };
  if (t.status === "in") return { label: "In range", tone: "success" };
  return null;
}

/** MetricDelta direction that colours a change by range-aware judgement. */
export function deltaDirection(
  t: Pick<BiomarkerTrajectory, "change" | "delta">,
): "good_higher" | "good_lower" | "neutral" {
  if (t.delta == null || t.change == null || t.change === "same") return "neutral";
  const up = t.delta > 0;
  if (t.change === "better") return up ? "good_higher" : "good_lower";
  return up ? "good_lower" : "good_higher";
}

export function fmtValue(v: number): string {
  if (Math.abs(v) >= 100) return String(Math.round(v));
  if (Math.abs(v) >= 10) return String(Math.round(v * 10) / 10);
  return String(Math.round(v * 100) / 100);
}

export function fmtRange(t: Pick<BiomarkerTrajectory, "range" | "rangeText">): string | null {
  const { lo, hi } = t.range;
  if (lo != null && hi != null) return `${fmtValue(lo)}–${fmtValue(hi)}`;
  if (hi != null) return `< ${fmtValue(hi)}`;
  if (lo != null) return `> ${fmtValue(lo)}`;
  return t.rangeText;
}

export function markerHref(name: string) {
  return `/tests/${encodeURIComponent(name)}`;
}

export default function BiomarkerRow({ t }: { t: BiomarkerTrajectory }) {
  const chip = statusChip(t);
  const range = fmtRange(t);
  const toneColor =
    t.status === "out" ? "var(--error)" : t.status === "near" ? "var(--warn)" : "var(--foreground)";
  return (
    <Link
      href={markerHref(t.name)}
      className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 transition-colors active:bg-[var(--surface-alt)]"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-medium">{t.displayName}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-[var(--muted)]">
          {range && <span className="tabular-nums">ref {range}</span>}
          {t.previous && t.delta != null && (
            <MetricDelta
              delta={Number(fmtValue(t.delta))}
              direction={deltaDirection(t)}
              hideOnZero={false}
            />
          )}
        </span>
      </span>
      {t.history.length > 1 && (
        <Sparkline
          values={t.history.map((h) => h.value)}
          mode="line"
          width={48}
          height={24}
          color={t.status === "out" || t.status === "near" ? toneColor : "var(--foreground-soft)"}
          ariaLabel={`${t.history.length} draws`}
        />
      )}
      <span className="flex min-w-[92px] shrink-0 flex-col items-end gap-1">
        <span className="tabular-nums">
          <span className="text-title-3" style={{ color: toneColor }}>
            {fmtValue(t.latest.value)}
          </span>
          {t.unit && <span className="ml-1 text-caption text-[var(--muted)]">{t.unit}</span>}
        </span>
        {chip && t.status !== "in" && (
          <Chip size="sm" tone={chip.tone}>
            {chip.label}
          </Chip>
        )}
      </span>
      <Icon name="chevron-right" size={16} strokeWidth={2} className="shrink-0 text-[var(--muted)]" />
    </Link>
  );
}
