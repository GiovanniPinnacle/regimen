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
import SwipeDismiss from "@/components/SwipeDismiss";
import { cardClass } from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import { IconButton } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Section";
import type { IngredientStackResult, IngredientWarning } from "@/lib/ingredient-stack";
import { localDateISO } from "@/lib/series";

const HIDE_KEY_BASE = "regimen.stackwarn.dismissed_today.v1";

const SEV_STYLE: Record<
  IngredientWarning["severity"],
  { tone: "danger" | "warn"; text: string; tile: string; label: string }
> = {
  critical: {
    tone: "danger",
    text: "text-[var(--error)]",
    tile: "bg-[var(--error-tint)] text-[var(--error)]",
    label: "Critical",
  },
  warning: {
    tone: "warn",
    text: "text-[var(--warn)]",
    tile: "bg-[var(--warn-tint)] text-[var(--warn)]",
    label: "Over UL",
  },
  info: {
    tone: "warn",
    text: "text-[var(--warn)]",
    tile: "bg-[var(--warn-tint)] text-[var(--warn)]",
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
        localDateISO()
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
      localStorage.setItem(hideKey, localDateISO());
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
    <SwipeDismiss onDismiss={dismiss} disabled={persistent}>
      <section
        className={cardClass({
          tone: style.tone,
          padding: "none",
          className: "relative mb-5 overflow-hidden",
        })}
      >
        <div className="flex items-start gap-3 px-4 py-3.5">
          <span
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${style.tile}`}
            aria-hidden
          >
            <Icon name="alert" size={18} strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <div className={`text-eyebrow uppercase ${style.text}`}>
              Stack safety check
            </div>
            <div className="mt-0.5 text-body font-semibold leading-snug">
              {headline}
            </div>
            <div className="mt-1 text-footnote leading-relaxed text-[var(--foreground-soft)]">
              Cumulative dose across multiple items — single labels won&apos;t flag this.
            </div>
          </div>
          {persistent ? null : (
            <IconButton
              icon="x"
              label="Dismiss for today"
              tone="plain"
              size={32}
              iconSize={16}
              onClick={dismiss}
              className="-mr-1.5 -mt-1"
            />
          )}
        </div>

        <div className="space-y-2 border-t border-[var(--border)] px-4 pb-3 pt-3">
          {data.warnings.map((w) => {
            const ws = SEV_STYLE[w.severity];
            const isOpen = expandedKey === w.ingredient_key;
            return (
              <div
                key={w.ingredient_key}
                className="overflow-hidden rounded-[14px] bg-[var(--surface)]"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() =>
                    setExpandedKey(isOpen ? null : w.ingredient_key)
                  }
                  className="flex min-h-[44px] w-full items-center gap-3 px-3 py-2.5 text-left"
                >
                  <Chip tone={ws.tone} className="shrink-0">
                    {ws.label}
                  </Chip>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-callout font-semibold">
                      {w.label}
                    </div>
                    <div className="text-caption tabular-nums text-[var(--foreground-soft)]">
                      {w.total_amount} {w.unit} / day · UL {w.ul} {w.unit} ·{" "}
                      <span className={`font-semibold ${ws.text}`}>
                        {Math.round(w.ratio * 100)}%
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 text-[var(--muted)]">
                    <Icon
                      name="chevron-right"
                      size={16}
                      className={`transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                  </span>
                </button>
                {isOpen ? (
                  <div className="space-y-2 px-3 pb-3 pt-1 text-footnote text-[var(--foreground-soft)]">
                    <div className="leading-relaxed">{w.rationale}</div>
                    <div>
                      <Eyebrow className="mb-1">Sources</Eyebrow>
                      <ul className="space-y-1">
                        {w.sources.map((s, i) => (
                          <li
                            key={`${s.item_id}-${i}`}
                            className="flex items-baseline justify-between gap-3"
                          >
                            <span className="truncate text-[var(--foreground)]">
                              {s.item_name}
                            </span>
                            <span className="shrink-0 tabular-nums text-[var(--muted)]">
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
    </SwipeDismiss>
  );
}
