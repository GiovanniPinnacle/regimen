"use client";

// RecentBiomarkers — shows the latest biomarker values per name with
// the previous draw alongside for trend. Tap a row to see the full
// history of that marker.
//
// Lives on /tests above the items list. Coach context already reads
// the biomarkers table (next round wires it in), so saving a panel
// here means Coach knows your ferritin / D / TSH / etc. values
// going forward.

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import Sparkline from "@/components/Sparkline";
import MetricDelta from "@/components/MetricDelta";
import { createClient } from "@/lib/supabase/client";

type Marker = {
  id: string;
  name: string;
  display_name: string | null;
  value: number;
  unit: string | null;
  reference_range: string | null;
  flag: string | null;
  drawn_on: string;
  panel: string | null;
};

export default function RecentBiomarkers({
  refreshKey,
}: {
  refreshKey?: number;
}) {
  const [markers, setMarkers] = useState<Marker[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const client = createClient();
      const { data } = await client
        .from("biomarkers")
        .select("*")
        .order("drawn_on", { ascending: false })
        .order("name");
      if (!alive) return;
      setMarkers((data ?? []) as Marker[]);
    })();
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  if (markers === null) {
    return (
      <div className="text-[13px] py-4" style={{ color: "var(--muted)" }}>
        Loading biomarkers…
      </div>
    );
  }
  if (markers.length === 0) return null;

  // Group by name, keep newest first; for each name pick latest value
  // + previous (for trend arrow).
  const byName = new Map<string, Marker[]>();
  for (const m of markers) {
    if (!byName.has(m.name)) byName.set(m.name, []);
    byName.get(m.name)!.push(m);
  }

  // Sort entries by latest drawn_on desc. `series` is the chronological
  // value-over-time array (oldest left, newest right) used to render
  // the inline trend Sparkline. `delta` compares latest to previous —
  // surfaced as a MetricDelta chip so users see direction + magnitude
  // at a glance instead of a single raw number.
  const entries = Array.from(byName.entries())
    .map(([name, list]) => {
      // list comes back newest-first because the upstream order() does
      // drawn_on desc — flip for the sparkline so today is on the right.
      const chrono = [...list].reverse();
      return {
        name,
        latest: list[0],
        prev: list[1] ?? null,
        series: chrono.map((m) => m.value),
        delta: list[1] ? list[0].value - list[1].value : 0,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.latest.drawn_on).getTime() -
        new Date(a.latest.drawn_on).getTime(),
    );

  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-2 px-0.5">
        <h2
          className="text-[11px] uppercase tracking-wider"
          style={{
            color: "var(--muted)",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          Recent biomarkers · {entries.length}
        </h2>
      </div>
      <div className="flex flex-col gap-1.5">
        {entries.map((e) => {
          const flagColor =
            e.latest.flag === "H"
              ? "var(--error)"
              : e.latest.flag === "L"
                ? "var(--warn)"
                : "var(--olive)";
          // Sparkline color matches the flag tone so the trend visually
          // agrees with the rollup (high-flagged marker → red trend).
          const sparkColor = e.latest.flag ? flagColor : "var(--accent)";
          return (
            <Link
              key={e.name}
              href={`/tests?marker=${encodeURIComponent(e.name)}`}
              className="rounded-xl card-glass px-3 py-3 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div
                  className="text-[14px] leading-tight"
                  style={{ fontWeight: 600, letterSpacing: "-0.005em" }}
                >
                  {e.latest.display_name ?? e.name.replace(/_/g, " ")}
                </div>
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span
                    className="text-[20px] tabular-nums leading-none"
                    style={{
                      color: e.latest.flag ? flagColor : "var(--foreground)",
                      fontWeight: 700,
                      letterSpacing: "-0.018em",
                    }}
                  >
                    {e.latest.value}
                  </span>
                  <span
                    className="text-[11px] leading-none"
                    style={{ color: "var(--muted)", fontWeight: 600 }}
                  >
                    {e.latest.unit}
                  </span>
                  {e.prev && (
                    <MetricDelta
                      delta={e.delta}
                      baseline="vs prev"
                      direction="neutral"
                      unit={e.latest.unit ?? ""}
                    />
                  )}
                  {e.latest.flag && (
                    <span
                      className="text-[9px] uppercase tracking-wider px-1.5 py-[1px] rounded-full"
                      style={{
                        background: flagColor,
                        color: "#FFFFFF",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                      }}
                    >
                      {e.latest.flag === "H"
                        ? "high"
                        : e.latest.flag === "L"
                          ? "low"
                          : e.latest.flag}
                    </span>
                  )}
                </div>
                <div
                  className="text-[11px] mt-1.5 flex items-baseline gap-2"
                  style={{ color: "var(--muted)" }}
                >
                  <span>{e.latest.drawn_on}</span>
                  {e.latest.reference_range && (
                    <span>· ref {e.latest.reference_range}</span>
                  )}
                  {e.series.length > 1 && (
                    <span>· {e.series.length} draws</span>
                  )}
                </div>
              </div>
              {/* Trend sparkline — line mode for continuous biomarker
                  values, sized so it sits comfortably without crowding
                  the chevron. Hidden when only one draw exists. */}
              {e.series.length > 1 && (
                <Sparkline
                  values={e.series}
                  mode="line"
                  width={64}
                  height={32}
                  color={sparkColor}
                  ariaLabel={`${e.series.length}-draw trend`}
                />
              )}
              <Icon
                name="chevron-right"
                size={14}
                className="shrink-0 opacity-40"
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
