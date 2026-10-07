"use client";

// WeeklyDigestCard — Monday/Tuesday-only inline summary on /today.
//
// Aggregates the last 7 days vs the 7 days before that into one card:
//   - Adherence delta (last week vs prev week, with arrow)
//   - Top helpers (items with the most "helped" reactions)
//   - Slipping items (per-item adherence dropped 25%+)
//   - Drop flags (items with 2+ "worse" reactions)
//   - Best day-of-week
//
// Action: "Discuss with Coach" pre-fills a focused prompt that uses the
// numbers as the conversation starting point. Dismissable per ISO week
// (localStorage) so it doesn't keep showing for the same week.

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import Card from "@/components/ui/Card";
import Button, { IconButton } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Section";
import MetricDelta from "@/components/MetricDelta";
import SwipeDismiss from "@/components/SwipeDismiss";
import { usePulseCount } from "@/components/CoachPulse";

type Digest = {
  generated_at: string;
  last_week: { rate: number; taken: number; total: number; uniqueDays: number };
  prev_week: { rate: number; taken: number; total: number; uniqueDays: number };
  delta_rate: number;
  top_helpers: { item_id: string; name: string; helped: number }[];
  drop_flags: { item_id: string; name: string; worse: number }[];
  slipping: { item_id: string; name: string; last: number; prev: number }[];
  best_day: { day: string; rate: number } | null;
  has_data: boolean;
};

const DISMISS_KEY = "regimen.weekly_digest.dismissed_week.v1";

/** ISO week number for the given date. We dismiss per ISO-week so the
 *  card surfaces fresh next Monday even if the user dismissed last
 *  Monday. */
function isoWeek(d: Date): string {
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export default function WeeklyDigestCard() {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [showing, setShowing] = useState<boolean>(false);

  useEffect(() => {
    // Only render Mon / Tue. Skip the network call entirely otherwise.
    const dow = new Date().getDay();
    if (dow !== 1 && dow !== 2) return;
    const week = isoWeek(new Date());
    try {
      if (localStorage.getItem(DISMISS_KEY) === week) return;
    } catch {}
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/weekly-digest", {
          credentials: "include",
        });
        if (!r.ok) return;
        const j = (await r.json()) as Digest;
        if (!j.has_data) return;
        if (alive) {
          setDigest(j);
          setShowing(true);
        }
      } catch {
        // silent
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, isoWeek(new Date()));
    } catch {}
    setShowing(false);
  }

  function discuss() {
    if (!digest) return;
    const lastPct = Math.round(digest.last_week.rate * 100);
    const prevPct = Math.round(digest.prev_week.rate * 100);
    const deltaPhrase =
      digest.delta_rate >= 0
        ? `up ${Math.round(digest.delta_rate * 100)}pp`
        : `down ${Math.abs(Math.round(digest.delta_rate * 100))}pp`;
    const slipText =
      digest.slipping.length > 0
        ? `Items slipping: ${digest.slipping.map((s) => `${s.name} (${Math.round(s.prev * 100)}%→${Math.round(s.last * 100)}%)`).join(", ")}.`
        : "";
    const dropText =
      digest.drop_flags.length > 0
        ? `Drop flags (2+ "worse"): ${digest.drop_flags.map((d) => d.name).join(", ")}.`
        : "";
    const helperText =
      digest.top_helpers.length > 0
        ? `Top helpers: ${digest.top_helpers.map((h) => `${h.name} (×${h.helped})`).join(", ")}.`
        : "";
    const prompt = [
      `Run my weekly stack review. Adherence ${lastPct}% last week vs ${prevPct}% the week before (${deltaPhrase}).`,
      slipText,
      dropText,
      helperText,
      `Pick the SINGLE highest-leverage move for next week and emit ONE proposal in <<<PROPOSAL ... PROPOSAL>>> format. Keep narrative under 4 sentences.`,
    ]
      .filter(Boolean)
      .join("\n\n");
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: prompt, send: true },
      }),
    );
    dismiss();
  }

  usePulseCount("digest", showing && digest ? 1 : 0);
  if (!showing || !digest) return null;

  const lastPct = Math.round(digest.last_week.rate * 100);
  const prevPct = Math.round(digest.prev_week.rate * 100);
  const deltaPp = Math.round(digest.delta_rate * 100);
  // Headline percentage stays neutral when it held or rose (green is
  // reserved for success moments) and turns error-red if it slipped.
  // The MetricDelta chip handles its own coloring.
  const trendColor = deltaPp >= 0 ? "var(--foreground)" : "var(--error)";

  return (
    <SwipeDismiss onDismiss={dismiss}>
      <Card padding="none" className="mb-5 overflow-hidden">
        <div className="px-4 py-3.5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
              <Icon name="graph" size={14} strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <Eyebrow>Weekly digest</Eyebrow>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
                <span
                  className="text-[24px] font-bold leading-none tracking-[-0.02em] tabular-nums"
                  style={{ color: trendColor }}
                >
                  {lastPct}%
                </span>
                <span className="text-footnote font-semibold text-[var(--foreground-soft)]">
                  adherence last week
                </span>
                <MetricDelta
                  delta={deltaPp}
                  baseline="vs prev"
                  direction="good_higher"
                  unit="pp"
                />
              </div>
              <p className="mt-1 text-footnote text-[var(--muted)]">
                {digest.last_week.taken}/{digest.last_week.total} logged across{" "}
                {digest.last_week.uniqueDays} days · prev week {prevPct}%
              </p>
            </div>
            <IconButton
              icon="x"
              label="Dismiss this week"
              tone="plain"
              size={36}
              iconSize={16}
              className="-mr-2 -mt-1"
              onClick={dismiss}
            />
          </div>

          <div className="mt-3 space-y-2">
            {digest.top_helpers.length > 0 ? (
              <DigestRow
                label="Helped most"
                accent="var(--foreground-soft)"
                entries={digest.top_helpers.map(
                  (h) => `${h.name} ×${h.helped}`,
                )}
              />
            ) : null}
            {digest.slipping.length > 0 ? (
              <DigestRow
                label="Slipping"
                accent="var(--warn)"
                entries={digest.slipping.map(
                  (s) =>
                    `${s.name} ${Math.round(s.prev * 100)}%→${Math.round(s.last * 100)}%`,
                )}
              />
            ) : null}
            {digest.drop_flags.length > 0 ? (
              <DigestRow
                label="Drop flags"
                accent="var(--error)"
                entries={digest.drop_flags.map(
                  (d) => `${d.name} ×${d.worse} worse`,
                )}
              />
            ) : null}
            {digest.best_day ? (
              <DigestRow
                label="Best day"
                accent="var(--muted)"
                entries={[
                  `${digest.best_day.day} · ${Math.round(digest.best_day.rate * 100)}%`,
                ]}
              />
            ) : null}
          </div>

          <div className="mt-3 flex gap-2 pl-10">
            <Button variant="coach" size="md" icon="sparkle" onClick={discuss}>
              Discuss with Coach
            </Button>
            <Button variant="secondary" size="md" onClick={dismiss}>
              Mark read
            </Button>
          </div>
        </div>
      </Card>
    </SwipeDismiss>
  );
}

function DigestRow({
  label,
  accent,
  entries,
}: {
  label: string;
  accent: string;
  entries: string[];
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className="min-w-[84px] shrink-0 text-eyebrow uppercase"
        style={{ color: accent }}
      >
        {label}
      </span>
      <span className="flex-1 text-footnote text-[var(--foreground-soft)]">
        {entries.join(" · ")}
      </span>
    </div>
  );
}
