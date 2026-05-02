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
import SwipeDismiss from "@/components/SwipeDismiss";

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

  if (!showing || !digest) return null;

  const lastPct = Math.round(digest.last_week.rate * 100);
  const prevPct = Math.round(digest.prev_week.rate * 100);
  const deltaPp = Math.round(digest.delta_rate * 100);
  const trendUp = deltaPp >= 0;
  const trendColor = trendUp ? "var(--accent)" : "var(--error)";
  const trendIcon: "trend-up" | "trend-down" = trendUp ? "trend-up" : "trend-down";

  return (
    <SwipeDismiss onDismiss={dismiss}>
    <section
      className="rounded-2xl card-glass mb-5 overflow-hidden"
      style={{ borderColor: "rgba(168, 85, 247, 0.30)" }}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <span
            className="shrink-0 mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center"
            style={{
              background: "rgba(168, 85, 247, 0.15)",
              color: "var(--pro)",
            }}
          >
            <Icon name="graph" size={14} strokeWidth={1.8} />
          </span>
          <div className="flex-1 min-w-0">
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{
                color: "var(--pro)",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              Weekly digest
            </div>
            <div
              className="text-[15px] leading-snug mt-0.5"
              style={{ fontWeight: 600 }}
            >
              {lastPct}% adherence last week
              <span
                className="text-[12px] ml-2 inline-flex items-center gap-0.5"
                style={{ color: trendColor, fontWeight: 700 }}
              >
                <Icon name={trendIcon} size={11} strokeWidth={2.2} />
                {Math.abs(deltaPp)}pp vs prev
              </span>
            </div>
            <div
              className="text-[12.5px] mt-1 leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              {digest.last_week.taken}/{digest.last_week.total} logged across{" "}
              {digest.last_week.uniqueDays} days · prev week {prevPct}%
            </div>
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 leading-none px-1 -mr-1 -mt-0.5"
            style={{ color: "var(--muted)" }}
            aria-label="Dismiss this week"
          >
            <Icon name="plus" size={14} className="rotate-45" />
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {digest.top_helpers.length > 0 ? (
            <DigestRow
              label="Helped most"
              accent="var(--accent)"
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
              accent="var(--pro)"
              entries={[
                `${digest.best_day.day} · ${Math.round(digest.best_day.rate * 100)}%`,
              ]}
            />
          ) : null}
        </div>

        <div className="flex gap-2 mt-3" style={{ paddingLeft: 40 }}>
          <button
            onClick={discuss}
            className="text-[13px] px-3.5 py-2 rounded-lg flex items-center gap-1.5 active:scale-[0.98] transition-transform"
            style={{
              background:
                "linear-gradient(135deg, var(--pro) 0%, #6D28D9 100%)",
              color: "#FBFAF6",
              fontWeight: 700,
              minHeight: 36,
            }}
          >
            <Icon name="sparkle" size={13} strokeWidth={2.2} />
            Discuss with Coach
          </button>
          <button
            onClick={dismiss}
            className="text-[13px] px-3.5 py-2 rounded-lg"
            style={{
              background: "var(--surface-alt)",
              color: "var(--foreground)",
              fontWeight: 600,
              minHeight: 36,
            }}
          >
            Mark read
          </button>
        </div>
      </div>
    </section>
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
        className="text-[10px] uppercase tracking-wider shrink-0"
        style={{
          color: accent,
          fontWeight: 700,
          letterSpacing: "0.06em",
          minWidth: 72,
        }}
      >
        {label}
      </span>
      <span
        className="text-[12.5px] flex-1 leading-snug"
        style={{ color: "var(--foreground-soft)" }}
      >
        {entries.join(" · ")}
      </span>
    </div>
  );
}
