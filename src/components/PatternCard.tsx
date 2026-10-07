"use client";

// PatternCard — surfaces high-signal patterns Coach would flag, computed
// via cheap heuristics (no LLM call). Stolen from Bearable's factor-
// correlation tile pattern. Visible on /today.
//
// Every pattern now has a primary action button that wires DIRECTLY to
// the proposals/execute API — no Coach roundtrip needed for mechanical
// changes (drop, pause, snooze). "Tell me more" hands off to Coach for
// nuanced cases.

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Eyebrow } from "@/components/ui/Section";
import { usePulseCount } from "@/components/CoachPulse";
import StepIndicator from "@/components/StepIndicator";
import CoachCardStack from "@/components/CoachCardStack";

type PatternKind =
  | "worse"
  | "drop_candidate"
  | "adherence"
  | "repeat_skip"
  | "streak_win";

type Pattern = {
  kind: PatternKind;
  severity: "urgent" | "high" | "medium" | "low";
  item_id: string;
  item_name: string;
  headline: string;
  detail: string;
};

// Severity → semantic tone. Green ("low" = it's working) is a true
// success signal; everything else is warn/error/neutral.
const SEVERITY_STYLES: Record<
  Pattern["severity"],
  {
    /** Eyebrow text color. */
    text: string;
    /** Icon tile (tint bg + ink). */
    tile: string;
    icon: "alert" | "trend-down" | "graph" | "award";
    label: string;
  }
> = {
  urgent: {
    text: "text-[var(--error)]",
    tile: "bg-[var(--error-tint)] text-[var(--error)]",
    icon: "alert",
    label: "Urgent",
  },
  high: {
    text: "text-[var(--warn)]",
    tile: "bg-[var(--warn-tint)] text-[var(--warn)]",
    icon: "trend-down",
    label: "Drop signal",
  },
  medium: {
    text: "text-[var(--muted)]",
    tile: "bg-[var(--surface-alt)] text-[var(--foreground-soft)]",
    icon: "graph",
    label: "Pattern",
  },
  low: {
    text: "text-[var(--success)]",
    tile: "bg-[var(--success-tint)] text-[var(--success)]",
    icon: "award",
    label: "Working",
  },
};

// Per-kind action: what the primary button does + how it labels itself.
// "direct" actions wire to /api/proposals/execute. "coach" actions seed
// Coach with a focused apply prompt.
type Action =
  | {
      kind: "direct";
      label: string;
      verb: string;
      action: "retire" | "adjust";
      extra?: Record<string, string>;
      reasoning: string;
    }
  | { kind: "coach"; label: string; verb: string; promptVerb: string }
  | { kind: "celebrate"; label: string; verb: string };

const KIND_ACTIONS: Record<PatternKind, (p: Pattern) => Action> = {
  worse: (p) => ({
    kind: "coach",
    label: "Pause",
    verb: "Pause it",
    promptVerb: `pause "${p.item_name}" for 14 days because reactions are worsening`,
  }),
  drop_candidate: (p) => ({
    kind: "direct",
    label: "Drop now",
    verb: "Drop now",
    action: "retire",
    reasoning: `Drop candidate from pattern detection: ${p.headline}`,
  }),
  adherence: (p) => ({
    kind: "coach",
    label: "Adjust",
    verb: "Adjust schedule",
    promptVerb: `adjust the timing or frequency of "${p.item_name}" so I actually take it consistently`,
  }),
  repeat_skip: (p) => ({
    kind: "coach",
    label: "Pause",
    verb: "Pause it",
    promptVerb: `pause "${p.item_name}" — I keep skipping it for the same reason`,
  }),
  streak_win: () => ({
    kind: "celebrate",
    label: "Lock it in",
    verb: "Lock it in",
  }),
};

export default function PatternCard() {
  const [patterns, setPatterns] = useState<Pattern[] | null>(null);
  const [loading, setLoading] = useState(true);
  // Cursor into `visible` for one-at-a-time rendering. We never
  // decrement — once the user advances past a pattern (acting on it
  // removes it from `visible` automatically; skipping just bumps
  // cursor) it doesn't come back this session.
  const [cursor, setCursor] = useState(0);
  const [executed, setExecuted] = useState<
    Record<string, "done" | "pending" | "error">
  >({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/patterns");
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!alive) return;
        setPatterns(data.patterns ?? []);
      } catch {
        if (!alive) return;
        setPatterns([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function patternId(p: Pattern) {
    return `${p.kind}:${p.item_id}`;
  }

  async function applyDirect(p: Pattern, action: Action) {
    if (action.kind !== "direct") return;
    const id = patternId(p);
    setExecuted((s) => ({ ...s, [id]: "pending" }));
    try {
      const res = await fetch("/api/proposals/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: action.action,
          item_name: p.item_name,
          reasoning: action.reasoning,
          extra: action.extra,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setExecuted((s) => ({ ...s, [id]: "done" }));
        window.dispatchEvent(
          new CustomEvent("regimen:toast", {
            detail: {
              kind: "success",
              text: `${action.verb}: ${p.item_name}`,
            },
          }),
        );
        // Refresh /today + /stack so the pattern's effect on the
        // user's actual stack shows immediately.
        window.dispatchEvent(new CustomEvent("regimen:items-changed"));
      } else {
        setExecuted((s) => ({ ...s, [id]: "error" }));
        window.dispatchEvent(
          new CustomEvent("regimen:toast", {
            detail: {
              kind: "error",
              text: data.error ?? "Couldn't apply",
            },
          }),
        );
      }
    } catch {
      setExecuted((s) => ({ ...s, [id]: "error" }));
    }
  }

  function applyCoach(p: Pattern, action: Action) {
    if (action.kind !== "coach") return;
    const id = patternId(p);
    setExecuted((s) => ({ ...s, [id]: "done" }));
    const prompt =
      `Pattern detected: ${p.headline}\n${p.detail}\n\n` +
      `Action requested: ${action.promptVerb}.\n\n` +
      `Generate ONE proposal in <<<PROPOSAL ... PROPOSAL>>> format I can approve in one tap.`;
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: prompt, send: true },
      }),
    );
  }

  function applyCelebrate(p: Pattern) {
    const id = patternId(p);
    setExecuted((s) => ({ ...s, [id]: "done" }));
    window.dispatchEvent(
      new CustomEvent("regimen:toast", {
        detail: {
          kind: "success",
          text: `Locked in: ${p.item_name}`,
        },
      }),
    );
  }

  function discuss(p: Pattern) {
    const prompt =
      `Pattern from my Today screen:\n\n${p.headline}\n${p.detail}\n\n` +
      `What should I think about? Don't propose changes unless I ask.`;
    window.dispatchEvent(
      new CustomEvent("regimen:ask", { detail: { text: prompt } }),
    );
  }

  const visible =
    !loading && patterns
      ? patterns.filter((p) => executed[patternId(p)] !== "done")
      : [];
  usePulseCount("patterns", visible.length);
  if (loading) return null;
  if (!patterns) return null;
  if (visible.length === 0) return null;

  // Show the pattern at the cursor position. If cursor went past the
  // end (user skipped them all), render null.
  if (cursor >= visible.length) return null;
  const top = visible[cursor];
  const topStyle = SEVERITY_STYLES[top.severity];
  const topAction = KIND_ACTIONS[top.kind](top);
  const topId = patternId(top);
  const topState = executed[topId];

  function renderActionButtons(p: Pattern, action: Action) {
    const id = patternId(p);
    const state = executed[id];
    const onPrimary = () => {
      if (action.kind === "direct") void applyDirect(p, action);
      else if (action.kind === "coach") applyCoach(p, action);
      else applyCelebrate(p);
    };
    // Coach hand-offs are violet; a direct drop is destructive; a
    // celebrate is the plain primary CTA.
    const variant =
      action.kind === "coach"
        ? "coach"
        : action.kind === "direct"
          ? "destructive"
          : "primary";
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          variant={variant}
          icon={action.kind === "coach" ? "sparkle" : "check-circle"}
          loading={state === "pending"}
          onClick={(e) => {
            e.stopPropagation();
            onPrimary();
          }}
        >
          {state === "pending" ? "Applying…" : action.verb}
        </Button>
        <Button
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            discuss(p);
          }}
        >
          Tell me more
        </Button>
      </div>
    );
  }

  return (
    <section className="mb-6">
      {visible.length > 1 && (
        <div className="mb-2 flex items-center justify-between px-0.5">
          <Eyebrow>Patterns</Eyebrow>
          <div className="flex items-center gap-2">
            <StepIndicator current={cursor} total={visible.length} />
            <span
              className="flex items-center gap-1 text-caption text-[var(--muted)]"
              aria-hidden
            >
              <Icon name="arrow-left" size={12} strokeWidth={2} />
              swipe
            </span>
          </div>
        </div>
      )}
      <CoachCardStack
        current={cursor}
        total={visible.length}
        onAdvance={() => setCursor((c) => c + 1)}
        swipeDisabled={topState === "done" || topState === "pending"}
      >
        <Card padding="none" className="overflow-hidden">
          <div className="flex items-start gap-3 px-4 pt-4 pb-3">
            <span
              aria-hidden
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${topStyle.tile}`}
            >
              <Icon name={topStyle.icon} size={16} strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <div className={`text-eyebrow uppercase ${topStyle.text}`}>
                {topStyle.label}
              </div>
              <div className="mt-0.5 text-callout font-semibold leading-snug">
                {top.headline}
              </div>
              <div className="mt-1 text-footnote leading-relaxed text-[var(--muted)]">
                {top.detail}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-4 pb-4 pl-[60px]">
            {topState !== "done" && renderActionButtons(top, topAction)}
            {visible.length > 1 && cursor < visible.length - 1 && (
              <Button
                variant="ghost"
                onClick={() => setCursor((c) => c + 1)}
              >
                Skip
              </Button>
            )}
          </div>
        </Card>
      </CoachCardStack>
    </section>
  );
}
