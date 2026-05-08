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

  // Sort entries by latest drawn_on desc
  const entries = Array.from(byName.entries())
    .map(([name, list]) => ({
      name,
      latest: list[0],
      prev: list[1] ?? null,
    }))
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
          const trend = e.prev
            ? e.latest.value > e.prev.value
              ? "↑"
              : e.latest.value < e.prev.value
                ? "↓"
                : "·"
            : null;
          return (
            <Link
              key={e.name}
              href={`/tests?marker=${encodeURIComponent(e.name)}`}
              className="rounded-xl card-glass px-3 py-2.5 flex items-center gap-2.5"
            >
              <div className="flex-1 min-w-0">
                <div
                  className="text-[13.5px] leading-tight"
                  style={{ fontWeight: 600 }}
                >
                  {e.latest.display_name ?? e.name.replace(/_/g, " ")}
                </div>
                <div
                  className="text-[11px] mt-0.5 flex items-baseline gap-2"
                  style={{ color: "var(--muted)" }}
                >
                  <span>{e.latest.drawn_on}</span>
                  {e.latest.reference_range && (
                    <span>· ref {e.latest.reference_range}</span>
                  )}
                  {e.prev && (
                    <span>
                      · prev {e.prev.value} on {e.prev.drawn_on}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className="text-[15px] tabular-nums"
                  style={{
                    color: e.latest.flag ? flagColor : "var(--foreground)",
                    fontWeight: 700,
                  }}
                >
                  {e.latest.value}
                </span>
                <span
                  className="text-[10px]"
                  style={{ color: "var(--muted)" }}
                >
                  {e.latest.unit}
                </span>
                {trend && (
                  <span
                    className="text-[12px] tabular-nums"
                    style={{ color: "var(--muted)" }}
                    aria-label={`Trend ${trend}`}
                  >
                    {trend}
                  </span>
                )}
                {e.latest.flag && (
                  <span
                    className="text-[9px] uppercase px-1.5 rounded-full"
                    style={{
                      background: flagColor,
                      color: "#FBFAF6",
                      fontWeight: 700,
                      minWidth: 20,
                      textAlign: "center",
                    }}
                  >
                    {e.latest.flag}
                  </span>
                )}
                <Icon
                  name="chevron-right"
                  size={12}
                  className="opacity-40"
                />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
