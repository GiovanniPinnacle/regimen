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
import Card from "@/components/ui/Card";
import Button, { IconButton } from "@/components/ui/Button";
import SwipeDismiss from "@/components/SwipeDismiss";
import { usePulseCount } from "@/components/CoachPulse";
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

  usePulseCount("correlations", showing && top ? 1 : 0);
  if (!showing || !top) return null;

  return (
    <SwipeDismiss onDismiss={dismiss}>
      <Card tone="warn" padding="none" className="relative mb-5 overflow-hidden">
        <div className="px-4 py-3.5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--warn-tint)] text-[var(--warn)]">
              <Icon name="alert" size={14} strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-eyebrow uppercase text-[var(--warn)]">
                Possible link
              </div>
              <div className="mt-0.5 text-body font-semibold">
                {top.symptom_label} dropped {top.worse_by} pts
              </div>
              <p className="mt-1 text-footnote text-[var(--muted)]">
                {top.baseline_avg} → {top.recent_avg} starting {top.trend_start_date}.
                {" "}
                {top.candidate_changes.length} stack change
                {top.candidate_changes.length === 1 ? "" : "s"} happened in the
                {" "}14 days before.
              </p>
            </div>
            <IconButton
              icon="x"
              label="Dismiss for 2 weeks"
              tone="plain"
              size={36}
              iconSize={16}
              className="-mr-2 -mt-1"
              onClick={dismiss}
            />
          </div>

          <div className="mt-3 space-y-1 pl-10">
            {top.candidate_changes.slice(0, 3).map((c, i) => (
              <div
                key={i}
                className="flex items-baseline gap-2 text-caption text-[var(--foreground-soft)]"
              >
                <span className="shrink-0 tabular-nums text-[var(--muted)]">
                  {c.days_before_trend}d
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="text-[var(--foreground)]">
                    {c.change_type}
                  </strong>
                  {c.item_name ? `: ${c.item_name}` : ""}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex gap-2 pl-10">
            <Button variant="coach" size="md" icon="sparkle" onClick={investigate}>
              Investigate
            </Button>
            <Button variant="secondary" size="md" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </div>
      </Card>
    </SwipeDismiss>
  );
}
