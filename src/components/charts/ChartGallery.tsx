"use client";

// ChartGallery — DEV-ONLY showcase of every chart with realistic mock
// data. Not a route: mount it temporarily (e.g. in a scratch page) to
// eyeball / screenshot the kit. Mock data is seeded and anchored to a
// fixed date so SSR and hydration render identically.

import { useState } from "react";
import type { ReactNode } from "react";
import Sparkline from "@/components/Sparkline";
import BarChart from "./BarChart";
import BarList from "./BarList";
import BeforeAfterBar from "./BeforeAfterBar";
import CalendarHeatmap from "./CalendarHeatmap";
import LineChart from "./LineChart";
import ScatterPlot from "./ScatterPlot";
import { addDays, formatLongDate } from "./scale";

const TODAY = "2026-10-06";

/** Deterministic PRNG (mulberry32) so mock data is stable. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function daysBack(n: number) {
  return Array.from({ length: n }, (_, i) => addDays(TODAY, i - (n - 1)));
}

// HRV (ms): ~48 baseline, magnesium started 30 days ago lifts it ~6 ms.
const r1 = rng(7);
const HRV = daysBack(60).map((x, i) => {
  if ([11, 12, 13, 38].includes(i)) return { x, y: null }; // missed wear
  const base = i >= 30 ? 54 : 48;
  return { x, y: Math.round(base + (r1() - 0.5) * 14) };
});

// Resting HR with personal baseline band + out-of-range days.
const r2 = rng(11);
const RHR = daysBack(30).map((x, i) => ({
  x,
  y: i === 19 ? 66 : i === 20 ? 63 : Math.round(56 + (r2() - 0.5) * 5),
}));

// Biomarker draws (sparse dates).
const FERRITIN = [
  { x: "2025-11-02", y: 38 },
  { x: "2026-01-15", y: 41 },
  { x: "2026-04-03", y: 47 },
  { x: "2026-06-20", y: 52 },
  { x: "2026-09-12", y: 58 },
];

// Protein grams, 14 days, goal 150.
const r3 = rng(3);
const PROTEIN = daysBack(14).map((x, i) => ({
  x,
  y: i === 5 ? null : Math.round(110 + r3() * 60),
}));

// Caffeine mg with an over-limit tone.
const r4 = rng(5);
const CAFFEINE = daysBack(21).map((x) => ({ x, y: Math.round(80 + r4() * 260) }));

// Adherence heatmap 0..1, a few gaps.
const r5 = rng(21);
const ADHERENCE = daysBack(13 * 7).map((date, i) => ({
  date,
  value: i % 17 === 4 ? null : r5() < 0.08 ? 0 : Math.min(1, Math.round((0.45 + r5() * 0.7) * 6) / 6),
}));

// Caffeine vs sleep score (negative correlation).
const r6 = rng(42);
const SCATTER = daysBack(28).map((x) => {
  const caf = Math.round(40 + r6() * 360);
  return { x: caf, y: Math.round(88 - caf * 0.06 + (r6() - 0.5) * 16), label: formatLongDate(x) };
});

function Card({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section
      className="flex flex-col gap-3 rounded-[var(--r-lg)] p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <header>
        <h3 className="text-eyebrow m-0 uppercase" style={{ color: "var(--muted)" }}>
          {title}
        </h3>
        {sub && (
          <p className="text-caption m-0 mt-0.5" style={{ color: "var(--foreground-soft)" }}>
            {sub}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}

export default function ChartGallery() {
  const [picked, setPicked] = useState<string | undefined>(undefined);

  return (
    <div className="mx-auto grid max-w-[1100px] gap-4 p-4 md:grid-cols-2">
      <Card title="LineChart · rolling + marker" sub="HRV, 7-day average, raw readings as dots">
        <LineChart
          points={HRV}
          rolling={7}
          markers={[{ x: addDays(TODAY, -29), label: "Started magnesium" }]}
          area
          unit="ms"
          ariaLabel="Heart rate variability, last 60 days"
        />
      </Card>

      <Card title="LineChart · band + out-of-range" sub="Resting HR vs your 30-day baseline">
        <LineChart
          points={RHR}
          band={{ lo: 53, hi: 59, label: "Your baseline" }}
          outOfRangeTone
          unit="bpm"
          ariaLabel="Resting heart rate, last 30 days"
        />
      </Card>

      <Card title="LineChart · sparse draws + target" sub="Ferritin — date-scaled x, not index">
        <LineChart points={FERRITIN} target={60} unit="ng/mL" height={140} ariaLabel="Ferritin lab results" />
      </Card>

      <Card title="LineChart · empty state">
        <LineChart points={[{ x: TODAY, y: 7.2 }]} height={120} ariaLabel="Sleep duration" />
      </Card>

      <Card title="BarChart · daily totals vs goal" sub="Protein, 14 days — goal hits go green">
        <BarChart bars={PROTEIN} target={150} unit="g" ariaLabel="Daily protein, last 14 days" />
      </Card>

      <Card title="BarChart · custom tone" sub="Caffeine — over 300 mg flagged">
        <BarChart
          bars={CAFFEINE}
          target={300}
          targetLabel="Limit"
          tone={(y) => (y > 300 ? "warn" : "neutral")}
          unit="mg"
          ariaLabel="Daily caffeine, last 21 days"
        />
      </Card>

      <Card title="CalendarHeatmap" sub={picked ? `Selected ${formatLongDate(picked)}` : "Tap a day"}>
        <CalendarHeatmap
          days={ADHERENCE}
          today={TODAY}
          selected={picked}
          onSelect={setPicked}
          ariaLabel="Daily stack adherence"
        />
      </Card>

      <Card title="BeforeAfterBar" sub="Since starting magnesium glycinate">
        <div className="flex flex-col gap-5">
          <BeforeAfterBar label="HRV" before={{ mean: 47.8, n: 30 }} after={{ mean: 54.1, n: 28 }} unit="ms" direction="good_higher" />
          <BeforeAfterBar label="Resting HR" before={{ mean: 57.2, n: 30 }} after={{ mean: 58.4, n: 28 }} unit="bpm" direction="good_lower" />
          <BeforeAfterBar label="Sleep latency" before={{ mean: 22, n: 12 }} after={{ mean: 14, n: 4 }} unit="min" direction="good_lower" />
        </div>
      </Card>

      <Card title="BarList" sub="Adherence by item, last 30 days">
        <BarList
          unit="%"
          max={100}
          rows={[
            { label: "Creatine 5g", value: 97, sub: "29 of 30 days", tone: "good" },
            { label: "Vitamin D3 + K2", value: 90, sub: "27 of 30 days", tone: "good" },
            { label: "Magnesium glycinate", value: 73, sub: "22 of 30 days" },
            { label: "Fish oil", value: 50, sub: "15 of 30 days", tone: "warn" },
            { label: "Zinc", value: 17, sub: "5 of 30 days", tone: "bad" },
          ]}
        />
      </Card>

      <Card title="ScatterPlot · trendline" sub="Caffeine vs sleep score, 28 days">
        <ScatterPlot points={SCATTER} xLabel="Caffeine" yLabel="Sleep score" xUnit="mg" trendline ariaLabel="Caffeine versus sleep score" />
      </Card>

      <Card title="Sparkline · line auto-domain vs legacy 0..max">
        <div className="flex items-center gap-6">
          <div className="flex flex-col gap-1">
            <Sparkline values={FERRITIN.map((p) => p.y)} mode="line" width={80} height={28} color="var(--foreground)" ariaLabel="auto domain" />
            <span className="text-caption" style={{ color: "var(--muted)" }}>auto</span>
          </div>
          <div className="flex flex-col gap-1">
            <Sparkline values={FERRITIN.map((p) => p.y)} mode="line" width={80} height={28} max={60} color="var(--foreground)" ariaLabel="0..max" />
            <span className="text-caption" style={{ color: "var(--muted)" }}>max=60</span>
          </div>
          <div className="flex flex-col gap-1">
            <Sparkline values={[1, 1, 0.5, null, 1, 0.8, 1]} mode="bars" width={80} height={28} max={1} ariaLabel="bars" />
            <span className="text-caption" style={{ color: "var(--muted)" }}>bars</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
