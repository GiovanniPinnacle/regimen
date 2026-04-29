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

const SEVERITY_STYLES: Record<
  Pattern["severity"],
  {
    accent: string;
    icon: "alert" | "trend-down" | "graph" | "award";
    label: string;
  }
> = {
  urgent: { accent: "var(--error)", icon: "alert", label: "Urgent" },
  high: { accent: "var(--warn)", icon: "trend-down", label: "Drop signal" },
  medium: { accent: "var(--muted)", icon: "graph", label: "Pattern" },
  low: { accent: "var(--accent)", icon: "award", label: "Working" },
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
  const [expanded, setExpanded] = useState(false);
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

  if (loading) return null;
  if (!patterns) return null;
  const visible = patterns.filter((p) => executed[patternId(p)] !== "done");
  if (visible.length === 0) return null;

  const top = visible[0];
  const rest = visible.slice(1);
  const topStyle = SEVERITY_STYLES[top.severity];
  const topAction = KIND_ACTIONS[top.kind](top);
  const topId = patternId(top);
  const topState = executed[topId];

  function renderActionButtons(p: Pattern, action: Action, compact = false) {
    const id = patternId(p);
    const state = executed[id];
    const onPrimary = () => {
      if (action.kind === "direct") void applyDirect(p, action);
      else if (action.kind === "coach") applyCoach(p, action);
      else applyCelebrate(p);
    };
    const buttonAccent =
      action.kind === "celebrate"
        ? "var(--accent)"
        : p.severity === "urgent"
          ? "var(--error)"
          : p.severity === "high"
            ? "var(--warn)"
            : "var(--pro)";
    return (
      <div className={`flex gap-2 ${compact ? "" : "mt-3"}`}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrimary();
          }}
          disabled={state === "pending"}
          className="text-[12.5px] px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          style={{
            background: buttonAccent,
            color: "#FBFAF6",
            fontWeight: 600,
            opacity: state === "pending" ? 0.6 : 1,
          }}
        >
          {state === "pending" ? (
            "Applying…"
          ) : (
            <>
              <Icon name="check-circle" size={12} strokeWidth={2.2} />
              {action.verb}
            </>
          )}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            discuss(p);
          }}
          className="text-[12.5px] px-3 py-1.5 rounded-lg"
          style={{
            background: "var(--surface-alt)",
            color: "var(--foreground-soft)",
          }}
        >
          Tell me more
        </button>
      </div>
    );
  }

  return (
    <section className="rounded-2xl card-glass mb-6 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 pt-3.5 pb-3 text-left flex items-start gap-3"
      >
        <span
          className="shrink-0 mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center"
          style={{
            background: `${topStyle.accent}1F`,
            color: topStyle.accent,
          }}
        >
          <Icon name={topStyle.icon} size={14} strokeWidth={1.8} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span
              className="text-[10px] uppercase tracking-wider"
              style={{
                color: topStyle.accent,
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              {topStyle.label}
            </span>
            {visible.length > 1 && (
              <span
                className="text-[11px]"
                style={{ color: "var(--muted)" }}
              >
                +{visible.length - 1} more
              </span>
            )}
          </div>
          <div
            className="text-[14px] leading-snug"
            style={{ fontWeight: 600 }}
          >
            {top.headline}
          </div>
          <div
            className="text-[12.5px] mt-1 leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            {top.detail}
          </div>
        </div>
        {visible.length > 1 && (
          <span
            className="shrink-0 mt-1 transition-transform"
            style={{
              transform: expanded ? "rotate(180deg)" : undefined,
            }}
          >
            <Icon name="chevron-down" size={16} />
          </span>
        )}
      </button>
      <div className="px-4 pb-3 ml-10">
        {topState !== "done" && renderActionButtons(top, topAction, true)}
      </div>

      {expanded && rest.length > 0 && (
        <div
          className="px-4 pt-1 pb-3 flex flex-col"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {rest.map((p, i) => {
            const s = SEVERITY_STYLES[p.severity];
            const action = KIND_ACTIONS[p.kind](p);
            return (
              <div
                key={`${p.item_id}-${p.kind}-${i}`}
                className="py-3 flex flex-col gap-2"
                style={{
                  borderBottom:
                    i < rest.length - 1
                      ? "1px solid var(--border)"
                      : undefined,
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="shrink-0 mt-0.5 h-6 w-6 rounded-lg flex items-center justify-center"
                    style={{
                      background: `${s.accent}1F`,
                      color: s.accent,
                    }}
                  >
                    <Icon name={s.icon} size={12} strokeWidth={1.8} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[13px] leading-snug"
                      style={{ fontWeight: 600 }}
                    >
                      {p.headline}
                    </div>
                    <div
                      className="text-[11.5px] mt-0.5 leading-relaxed"
                      style={{ color: "var(--muted)" }}
                    >
                      {p.detail}
                    </div>
                  </div>
                </div>
                <div className="ml-9">{renderActionButtons(p, action, true)}</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
