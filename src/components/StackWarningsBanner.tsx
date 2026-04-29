"use client";

// StackWarningsBanner — surfaces cumulative ingredient dosing problems.
//
// A user can be 100% within-target on each individual supplement and
// still hit toxic cumulative doses. Vit D from a multi (1000 IU) + a D3
// cap (5000 IU) + cod liver oil (400 IU) = 6400 IU/day, well above the
// NIH 4000 IU UL. No single label flags it. We do.
//
// Surfaces only when there's at least one warning. Click expands to show
// per-ingredient breakdown with sources. Dismissed-for-today is opt-out
// (localStorage), since the user might want a quick visual reminder
// every load.

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import type { IngredientStackResult, IngredientWarning } from "@/lib/ingredient-stack";

const HIDE_KEY_BASE = "regimen.stackwarn.dismissed_today.v1";

const SEV_STYLE: Record<
  IngredientWarning["severity"],
  { bg: string; border: string; chip: string; chipText: string; label: string }
> = {
  critical: {
    bg: "linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(239, 68, 68, 0.06) 100%)",
    border: "rgba(239, 68, 68, 0.40)",
    chip: "rgba(239, 68, 68, 0.20)",
    chipText: "var(--error)",
    label: "Critical",
  },
  warning: {
    bg: "linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(245, 158, 11, 0.06) 100%)",
    border: "rgba(245, 158, 11, 0.40)",
    chip: "rgba(245, 158, 11, 0.20)",
    chipText: "var(--warn)",
    label: "Over UL",
  },
  info: {
    bg: "linear-gradient(135deg, rgba(245, 158, 11, 0.10) 0%, rgba(245, 158, 11, 0.03) 100%)",
    border: "rgba(245, 158, 11, 0.25)",
    chip: "rgba(245, 158, 11, 0.14)",
    chipText: "var(--warn)",
    label: "Approaching",
  },
};

type Props = {
  /** Per-surface scope so dismissing on /today doesn't hide it on /audit
   *  where the user is actively triaging. Defaults to "today". */
  surface?: "today" | "audit";
  /** Skip the dismiss button entirely — useful on surfaces that are
   *  always action-oriented (the audit page). */
  persistent?: boolean;
};

export default function StackWarningsBanner({
  surface = "today",
  persistent = false,
}: Props = {}) {
  const hideKey = `${HIDE_KEY_BASE}.${surface}`;
  const [data, setData] = useState<IngredientStackResult | null>(null);
  // Lazy init reads localStorage on the very first render — no effect
  // needed, no cascading-render warning. SSR-safe via the window check.
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (persistent) return false;
    if (typeof window === "undefined") return false;
    try {
      return (
        localStorage.getItem(hideKey) ===
        new Date().toISOString().slice(0, 10)
      );
    } catch {
      return false;
    }
  });
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    if (dismissed) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/ingredient-stack", {
          credentials: "include",
        });
        if (!r.ok) return;
        const j = (await r.json()) as IngredientStackResult;
        if (alive) setData(j);
      } catch {
        // silent — this is a non-critical surface
      }
    })();
    return () => {
      alive = false;
    };
  }, [dismissed]);

  function dismiss() {
    try {
      localStorage.setItem(hideKey, new Date().toISOString().slice(0, 10));
    } catch {}
    setDismissed(true);
  }

  if (dismissed || !data || data.warnings.length === 0) return null;

  // Headline severity: take the worst tier present.
  const topSev = data.warnings[0].severity;
  const style = SEV_STYLE[topSev];
  const overCount = data.warnings.filter(
    (w) => w.severity === "critical" || w.severity === "warning",
  ).length;
  const headline =
    overCount > 0
      ? `${overCount} ingredient${overCount === 1 ? "" : "s"} over Tolerable Upper Intake Level`
      : `${data.warnings.length} ingredient${data.warnings.length === 1 ? "" : "s"} approaching UL`;

  return (
    <section
      className="rounded-2xl mb-5 overflow-hidden relative"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
      }}
    >
      <div className="px-4 py-3.5 flex items-start gap-3">
        <span
          className="shrink-0 mt-0.5 h-9 w-9 rounded-lg flex items-center justify-center text-[18px]"
          style={{ background: style.chip }}
        >
          ⚠️
        </span>
        <div className="flex-1 min-w-0">
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{
              color: style.chipText,
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            Stack safety check
          </div>
          <div
            className="text-[15px] leading-snug mt-0.5"
            style={{ fontWeight: 600 }}
          >
            {headline}
          </div>
          <div
            className="text-[12px] mt-1 leading-relaxed"
            style={{ color: "var(--foreground-soft)" }}
          >
            Cumulative dose across multiple items — single labels won&apos;t flag this.
          </div>
        </div>
        {persistent ? null : (
          <button
            onClick={dismiss}
            className="shrink-0 leading-none px-1 -mr-1"
            style={{ color: "var(--muted)" }}
            aria-label="Dismiss for today"
          >
            <Icon name="plus" size={14} className="rotate-45" />
          </button>
        )}
      </div>

      <div
        className="px-4 pb-3 pt-1 space-y-2"
        style={{ borderTop: `1px solid ${style.border}` }}
      >
        {data.warnings.map((w) => {
          const ws = SEV_STYLE[w.severity];
          const isOpen = expandedKey === w.ingredient_key;
          return (
            <div
              key={w.ingredient_key}
              className="rounded-lg overflow-hidden"
              style={{ background: "rgba(0, 0, 0, 0.18)" }}
            >
              <button
                onClick={() =>
                  setExpandedKey(isOpen ? null : w.ingredient_key)
                }
                className="w-full px-3 py-2.5 flex items-center gap-3 text-left"
              >
                <span
                  className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{
                    background: ws.chip,
                    color: ws.chipText,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                  }}
                >
                  {ws.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[13px] truncate"
                    style={{ fontWeight: 600 }}
                  >
                    {w.label}
                  </div>
                  <div
                    className="text-[11px]"
                    style={{ color: "var(--foreground-soft)" }}
                  >
                    {w.total_amount} {w.unit} / day · UL {w.ul} {w.unit} ·{" "}
                    <span style={{ color: ws.chipText, fontWeight: 600 }}>
                      {Math.round(w.ratio * 100)}%
                    </span>
                  </div>
                </div>
                <span
                  style={{ color: "var(--muted)" }}
                  className="shrink-0"
                >
                  <Icon
                    name="chevron-right"
                    size={14}
                    className={isOpen ? "rotate-90" : ""}
                  />
                </span>
              </button>
              {isOpen ? (
                <div
                  className="px-3 pb-3 pt-1 text-[12px] space-y-2"
                  style={{ color: "var(--foreground-soft)" }}
                >
                  <div className="leading-relaxed">{w.rationale}</div>
                  <div>
                    <div
                      className="text-[10px] uppercase tracking-wider mb-1"
                      style={{
                        color: "var(--muted)",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                      }}
                    >
                      Sources
                    </div>
                    <ul className="space-y-1">
                      {w.sources.map((s, i) => (
                        <li
                          key={`${s.item_id}-${i}`}
                          className="flex items-baseline justify-between gap-3"
                        >
                          <span
                            style={{ color: "var(--foreground)" }}
                            className="truncate"
                          >
                            {s.item_name}
                          </span>
                          <span style={{ color: "var(--muted)" }}>
                            +{s.amount} {s.unit}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
