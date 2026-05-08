"use client";

// CoachPulse — the master card on /today that aggregates Coach's
// proactive surfaces into a single line. Closes the "Today is too
// cloggy" problem by collapsing 7+ separate cards (insights,
// suggestions, milestones, weekly digest, correlations, picks,
// patterns, next-step) behind one summary row.
//
// Default state: collapsed. One line shows total count + per-bucket
// badges:
//   ⚡ Coach has 4 — 1 check-in · 2 insights · 1 to drop
//
// Tap to expand. Inside, each bucket renders its existing component
// (we don't reinvent the cards — we just relocate them). Each card
// keeps its own dismiss/apply/etc. actions as before. Closing
// individual cards updates the badges live.
//
// CRITICAL banners (StackWarningsBanner, StreakAtRiskBanner,
// OnboardingBanner) are NOT inside the Pulse — they stay inline so
// urgent stuff never hides behind a tap.
//
// What lives inside the Pulse:
//   - NextStep (priority CTA)
//   - MilestoneCheckins (Day-N reactions)
//   - InsightsBanner (Coach's notes)
//   - SmartSuggestions (paired/topping/consolidate)
//   - CatalogPicks (high-evidence additions)
//   - WeeklyDigestCard (Mon/Tue rollup)
//   - SymptomCorrelationCard (n=1 hypotheses)
//   - PatternCard (skip/reaction patterns)
//
// Each subcomponent must expose a useEffect-driven count so the Pulse
// header can show "1 check-in · 2 insights · …" without re-running
// each component's data fetch. We piggyback on a custom event:
//   regimen:pulse-count {bucket: string, count: number}
// every Pulse-eligible card fires this on mount + when its data
// changes. Pulse aggregates and re-renders.

import { useEffect, useRef, useState, type ReactNode } from "react";
import Icon from "@/components/Icon";

// Buckets are display-ordered. Each child component announces its
// bucket via the regimen:pulse-count event so the header stays in
// sync without a parent-side data fetch.
export type PulseBucket =
  | "next_step"
  | "checkins"
  | "insights"
  | "suggestions"
  | "picks"
  | "digest"
  | "correlations"
  | "patterns";

const BUCKET_LABELS: Record<PulseBucket, { label: string; short: string }> = {
  next_step: { label: "next step", short: "step" },
  checkins: { label: "check-in", short: "check-in" },
  insights: { label: "insight", short: "insight" },
  suggestions: { label: "suggestion", short: "tweak" },
  picks: { label: "pick", short: "pick" },
  digest: { label: "weekly digest", short: "digest" },
  correlations: { label: "correlation", short: "pattern" },
  patterns: { label: "pattern", short: "pattern" },
};

const BUCKET_ORDER: PulseBucket[] = [
  "next_step",
  "checkins",
  "insights",
  "suggestions",
  "picks",
  "patterns",
  "correlations",
  "digest",
];

/** Helper hook: child components call this on mount + whenever their
 *  count changes to register their badge contribution. */
export function usePulseCount(bucket: PulseBucket, count: number) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("regimen:pulse-count", {
        detail: { bucket, count },
      }),
    );
    // Re-broadcast 0 on unmount so the bucket clears if the component
    // disappears (e.g. user dismisses the only insight in it).
    return () => {
      if (typeof window === "undefined") return;
      window.dispatchEvent(
        new CustomEvent("regimen:pulse-count", {
          detail: { bucket, count: 0 },
        }),
      );
    };
  }, [bucket, count]);
}

type Props = {
  /** Children are the registered card components. Each renders normally
   *  when expanded; collapsed, the Pulse hides them. */
  children: ReactNode;
  /** Open by default. */
  defaultOpen?: boolean;
};

export default function CoachPulse({
  children,
  defaultOpen = false,
}: Props) {
  const [counts, setCounts] = useState<Record<PulseBucket, number>>({
    next_step: 0,
    checkins: 0,
    insights: 0,
    suggestions: 0,
    picks: 0,
    digest: 0,
    correlations: 0,
    patterns: 0,
  });
  const [open, setOpen] = useState(defaultOpen);
  // Track if user manually toggled this session — once they do, we
  // respect their choice for the remainder of the page lifetime.
  const userToggled = useRef(false);

  useEffect(() => {
    function handle(e: Event) {
      const detail = (
        e as CustomEvent<{ bucket: PulseBucket; count: number }>
      ).detail;
      if (!detail?.bucket) return;
      setCounts((prev) =>
        prev[detail.bucket] === detail.count
          ? prev
          : { ...prev, [detail.bucket]: detail.count },
      );
    }
    window.addEventListener("regimen:pulse-count", handle);
    return () => window.removeEventListener("regimen:pulse-count", handle);
  }, []);

  const total = (Object.values(counts) as number[]).reduce(
    (a, b) => a + b,
    0,
  );

  const activeBuckets = BUCKET_ORDER.filter((b) => counts[b] > 0);

  function toggle() {
    userToggled.current = true;
    setOpen((v) => !v);
  }

  // CRITICAL: children must always be mounted (just visually hidden
  // when there's nothing to show) so their useEffects can call
  // usePulseCount and populate `counts`. If we returned null here on
  // first render (counts all 0), children would never mount, never
  // register, and `total` would stay 0 forever — the bug that made
  // Coach's memory + notes vanish entirely.
  return (
    <section className={total > 0 ? "mb-4" : ""}>
      {total > 0 && (
      <button
        onClick={toggle}
        className="w-full rounded-2xl card-glass overflow-hidden text-left transition-all"
        style={{
          borderLeft: "3px solid var(--accent)",
          minHeight: 56,
        }}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 px-3.5 py-3">
          <span
            className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, var(--accent) 0%, var(--accent-deep) 100%)",
              color: "#FFFFFF",
            }}
          >
            <Icon name="sparkle" size={16} strokeWidth={2} />
          </span>
          <div className="flex-1 min-w-0">
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{
                color: "var(--accent)",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              Coach&apos;s pulse
            </div>
            <div
              className="text-[14px] leading-snug mt-0.5 truncate"
              style={{ fontWeight: 600 }}
            >
              {total} thing{total === 1 ? "" : "s"} to look at
            </div>
            {!open && activeBuckets.length > 0 && (
              <div
                className="text-[11.5px] mt-1 leading-snug truncate"
                style={{ color: "var(--muted)" }}
              >
                {activeBuckets
                  .map((b) => {
                    const meta = BUCKET_LABELS[b];
                    const c = counts[b];
                    const word = c === 1 ? meta.short : `${meta.short}s`;
                    return `${c} ${word}`;
                  })
                  .join(" · ")}
              </div>
            )}
          </div>
          <Icon
            name="chevron-down"
            size={16}
            strokeWidth={2}
            className={`shrink-0 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>
      )}

      {/* Children stay mounted even when the Pulse header is hidden
          (total=0) or collapsed (total>0 but user hasn't expanded).
          They keep registering counts via usePulseCount so the moment
          something has data the Pulse header pops up. Without this,
          first render shows total=0 → return null → children never
          mount → counts stay 0 forever (the bug that made Coach's
          memory + notes disappear after the deploy). */}
      <div
        className={`${total > 0 && open ? "mt-1 px-0.5 pt-1 flex flex-col gap-2" : ""}`}
        style={total > 0 && open ? undefined : { display: "none" }}
        aria-hidden={!(total > 0 && open)}
      >
        {children}
      </div>
    </section>
  );
}
