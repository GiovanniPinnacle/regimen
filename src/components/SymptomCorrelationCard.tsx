"use client";

// SymptomCorrelationCard — surfaces "did X break your sleep?" hypotheses.
//
// Only renders when there's a real signal: a symptom dimension dropped
// at least 1 point on a 1-5 scale (3-day recent avg vs prior 7-day
// baseline), AND there are stack changes from the 14 days before that
// drop. Pure correlation — n=1 — so framed as a hypothesis, not a
// verdict.
//
// Action: "Investigate" opens Coach with the structured data pre-baked
// so Coach can rule causes in/out and propose a test (drop the
// candidate? swap timing? add bloodwork?).
//
// Dismiss = 14-day mute per symptom dimension to avoid badgering.

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import SwipeDismiss from "@/components/SwipeDismiss";
import type { SymptomCorrelation } from "@/lib/symptom-correlate";

const DISMISS_KEY_PREFIX = "regimen.symptom_correlation.dismissed.v1.";
const DISMISS_TTL_MS = 14 * 86400000;

type Resp = {
  correlations: SymptomCorrelation[];
  top: SymptomCorrelation | null;
};

function readDismissed(symptom: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(`${DISMISS_KEY_PREFIX}${symptom}`);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export default function SymptomCorrelationCard() {
  const [top, setTop] = useState<SymptomCorrelation | null>(null);
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/symptom-correlations", {
          credentials: "include",
        });
        if (!r.ok) return;
        const j = (await r.json()) as Resp;
        if (!alive) return;
        // Pick the top non-dismissed correlation.
        const pick = j.correlations.find((c) => !readDismissed(c.symptom));
        if (!pick) return;
        setTop(pick);
        setShowing(true);
      } catch {
        // silent
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function dismiss() {
    if (!top) return;
    try {
      localStorage.setItem(
        `${DISMISS_KEY_PREFIX}${top.symptom}`,
        String(Date.now()),
      );
    } catch {}
    setShowing(false);
  }

  function investigate() {
    if (!top) return;
    const changeList = top.candidate_changes
      .map(
        (c) =>
          `- ${c.happened_on} (${c.days_before_trend}d before): ${c.change_type}${c.item_name ? ` ${c.item_name}` : ""}${c.reasoning ? ` — "${c.reasoning}"` : ""}`,
      )
      .join("\n");
    const prompt = `My ${top.symptom_label} dropped from ${top.baseline_avg} (7-day avg) to ${top.recent_avg} (last 3 days), starting ${top.trend_start_date}. Stack changes from the 14 days before that decline:\n\n${changeList}\n\nRule the candidates in or out. Propose ONE test — drop a candidate, swap timing, run bloodwork — in <<<PROPOSAL ... PROPOSAL>>> format. Keep narrative under 4 sentences.`;
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: prompt, send: true },
      }),
    );
    dismiss();
  }

  if (!showing || !top) return null;

  return (
    <SwipeDismiss onDismiss={dismiss}>
    <section
      className="rounded-2xl mb-5 overflow-hidden relative"
      style={{
        background:
          "linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.04) 100%)",
        border: "1px solid rgba(245, 158, 11, 0.30)",
      }}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-3">
          <span
            className="shrink-0 mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center"
            style={{
              background: "rgba(245, 158, 11, 0.18)",
              color: "var(--warn)",
            }}
          >
            <Icon name="alert" size={14} strokeWidth={1.8} />
          </span>
          <div className="flex-1 min-w-0">
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{
                color: "var(--warn)",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              Possible link
            </div>
            <div
              className="text-[15px] leading-snug mt-0.5"
              style={{ fontWeight: 600 }}
            >
              {top.symptom_label} dropped {top.worse_by} pts
            </div>
            <div
              className="text-[12.5px] mt-1 leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              {top.baseline_avg} → {top.recent_avg} starting {top.trend_start_date}.
              {" "}
              {top.candidate_changes.length} stack change
              {top.candidate_changes.length === 1 ? "" : "s"} happened in the
              {" "}14 days before.
            </div>
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 leading-none px-1 -mr-1 -mt-0.5"
            style={{ color: "var(--muted)" }}
            aria-label="Dismiss for 2 weeks"
          >
            <Icon name="plus" size={14} className="rotate-45" />
          </button>
        </div>

        <div className="mt-3 space-y-1 pl-10">
          {top.candidate_changes.slice(0, 3).map((c, i) => (
            <div
              key={i}
              className="text-[12px] leading-snug flex items-baseline gap-2"
              style={{ color: "var(--foreground-soft)" }}
            >
              <span
                className="text-[10px] tabular-nums shrink-0"
                style={{ color: "var(--muted)" }}
              >
                {c.days_before_trend}d
              </span>
              <span className="flex-1 min-w-0">
                <strong style={{ color: "var(--foreground)" }}>
                  {c.change_type}
                </strong>
                {c.item_name ? `: ${c.item_name}` : ""}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-3 pl-10">
          <button
            onClick={investigate}
            className="text-[12.5px] px-3 py-1.5 rounded-lg flex items-center gap-1.5"
            style={{
              background: "var(--warn)",
              color: "#FBFAF6",
              fontWeight: 700,
            }}
          >
            <Icon name="sparkle" size={12} strokeWidth={2.2} />
            Investigate
          </button>
          <button
            onClick={dismiss}
            className="text-[12.5px] px-3 py-1.5 rounded-lg"
            style={{
              background: "var(--surface-alt)",
              color: "var(--foreground-soft)",
              fontWeight: 600,
            }}
          >
            Not now
          </button>
        </div>
      </div>
    </section>
    </SwipeDismiss>
  );
}
