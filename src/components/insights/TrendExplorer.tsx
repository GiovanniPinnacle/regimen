"use client";

// Oura trend explorer: metric + range switch, 7-day rolling mean over
// nightly dots, personal 30-day baseline band, item start markers.

import { useMemo, useState } from "react";
import LineChart from "@/components/charts/LineChart";
import MetricDelta from "@/components/MetricDelta";
import { Stat } from "@/components/ui/Section";
import Segmented from "@/components/ui/Segmented";
import { addDaysISO } from "@/lib/series";
import { METRICS, type MetricKey } from "@/lib/insights/metrics";
import type { HubModel, TrendMetric } from "@/lib/insights/hub";

const OPTIONS: { value: TrendMetric; label: string }[] = [
  { value: "hrv", label: "HRV" },
  { value: "rhr", label: "RHR" },
  { value: "sleep_score", label: "Sleep" },
  { value: "deep_sleep", label: "Deep" },
  { value: "readiness", label: "Ready" },
];

function fmtDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function fmt(v: number, key: MetricKey) {
  const d = METRICS[key];
  return d.decimals > 0 ? v.toFixed(d.decimals) : String(Math.round(v));
}

export default function TrendExplorer({
  trends,
  markers,
  today,
}: {
  trends: HubModel["trends"];
  markers: HubModel["markers"];
  today: string;
}) {
  const [metric, setMetric] = useState<TrendMetric>("hrv");
  const [range, setRange] = useState<"30" | "90">("90");
  const def = METRICS[metric];
  const t = trends[metric];
  const from = addDaysISO(today, -(Number(range) - 1));
  const points = useMemo(() => t.points.filter((p) => p.x >= from), [t.points, from]);
  const n = points.filter((p) => p.y != null).length;
  const b = t.baseline;
  const unit = def.unit || undefined;
  const latestDelta = b.latest && b.mean != null ? b.latest.value - b.mean : null;
  const zText =
    b.z == null
      ? null
      : `${b.z >= 0 ? "+" : "−"}${Math.abs(b.z).toFixed(1)} SD`;
  const statusText =
    b.status === "better"
      ? "better than usual"
      : b.status === "worse"
        ? "worse than usual"
        : b.status === "typical"
          ? "within your usual range"
          : null;

  return (
    <div>
      <Segmented
        ariaLabel="Metric"
        variant="pill"
        options={OPTIONS}
        value={metric}
        onChange={setMetric}
        className="mb-3 flex w-full"
      />
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-footnote text-[var(--muted)]">
          {def.label}
          {def.direction === "good_lower" ? " · lower is better" : ""}
        </span>
        <Segmented
          ariaLabel="Range"
          variant="pill"
          size="sm"
          options={[
            { value: "30", label: "30D" },
            { value: "90", label: "90D" },
          ]}
          value={range}
          onChange={setRange}
          className="shrink-0"
        />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <Stat
          label={b.latest ? `Latest · ${fmtDate(b.latest.date)}` : "Latest"}
          value={b.latest ? fmt(b.latest.value, metric) : "—"}
          unit={unit}
          delta={
            latestDelta != null ? (
              <MetricDelta
                delta={Number(latestDelta.toFixed(def.decimals || 0))}
                direction={def.direction}
                unit={unit && unit !== "%" ? ` ${unit}` : unit}
                baseline="vs baseline"
              />
            ) : undefined
          }
          sub={zText && statusText ? `${zText} · ${statusText}` : undefined}
        />
        <Stat
          label="30-day baseline"
          value={b.mean != null ? fmt(b.mean, metric) : "—"}
          unit={b.sd != null ? `± ${fmt(b.sd, metric)}${unit ? ` ${unit}` : ""}` : unit}
          sub={b.n > 0 ? `n=${b.n} · ${fmtDate(b.from)}–${fmtDate(b.to)}` : "No readings yet"}
        />
      </div>

      <LineChart
        points={points}
        rolling={7}
        band={b.band ? { lo: b.band.lo, hi: b.band.hi, label: "Your usual" } : undefined}
        markers={markers.filter((m) => m.x >= from)}
        unit={unit}
        decimals={def.decimals}
        height={170}
        ariaLabel={`${def.label}, last ${range} days, 7-day average`}
      />
      <p className="mt-2 text-caption text-[var(--muted)]">
        Line = 7-day average · dots = nightly readings (n={n}) · band = your 30-day mean ± 1 SD.
      </p>
    </div>
  );
}
