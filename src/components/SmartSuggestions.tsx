"use client";

// SmartSuggestions — proactive pairings/toppings/consolidation tips on
// /today. Pulls one suggestion at a time from /api/coach/suggestions
// (heuristic-first, Coach-fallback). User can:
//   - Apply (fires Coach with the focused prompt → one-tap proposal)
//   - Dismiss for now (localStorage 7-day mute)
//   - Tell me more (open Coach for discussion)
//
// Pattern: "wow how did they know to think of this?" → "tap to make it
// happen". The whole point is reducing the friction between insight
// and action.

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import SwipeDismiss from "@/components/SwipeDismiss";

type Suggestion = {
  id: string;
  kind: "pair" | "topping" | "consolidate" | "move_slot";
  title: string;
  body: string;
  apply_prompt: string;
  item_ids?: string[];
};

const KIND_ACCENT: Record<Suggestion["kind"], string> = {
  pair: "var(--accent)",
  topping: "var(--premium)",
  consolidate: "var(--pro)",
  move_slot: "var(--warn)",
};

const DISMISS_KEY_PREFIX = "regimen.smart_suggestion.dismissed.v1.";

export default function SmartSuggestions() {
  const [s, setS] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/coach/suggestions");
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        const sug = data.suggestion as Suggestion | null;
        if (!sug) return;
        // Honor 7-day dismissal
        try {
          const dismissedAt = localStorage.getItem(
            `${DISMISS_KEY_PREFIX}${sug.id}`,
          );
          if (dismissedAt) {
            const t = parseInt(dismissedAt, 10);
            if (Date.now() - t < 7 * 86400000) return;
          }
        } catch {}
        setS(sug);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function dismiss() {
    if (!s) return;
    try {
      localStorage.setItem(
        `${DISMISS_KEY_PREFIX}${s.id}`,
        String(Date.now()),
      );
    } catch {}
    setS(null);
  }

  function apply() {
    if (!s) return;
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: s.apply_prompt, send: true },
      }),
    );
    // Mark dismissed too so it doesn't keep popping after Coach acts
    try {
      localStorage.setItem(
        `${DISMISS_KEY_PREFIX}${s.id}`,
        String(Date.now()),
      );
    } catch {}
    setS(null);
  }

  function discuss() {
    if (!s) return;
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: {
          text: `Talk me through this idea before I apply it:\n\n**${s.title}**\n${s.body}\n\nWhat's the trade-off? Anything to watch for?`,
        },
      }),
    );
  }

  if (loading || !s) return null;

  const accent = KIND_ACCENT[s.kind];

  return (
    <SwipeDismiss onDismiss={dismiss}>
    <section className="rounded-2xl card-glass mb-5 overflow-hidden">
      <div className="px-4 py-3.5 flex items-start gap-3">
        <span
          className="shrink-0 mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center"
          style={{
            background: `${accent}1F`,
            color: accent,
          }}
        >
          <Icon name="sparkle" size={13} strokeWidth={2} />
        </span>
        <div className="flex-1 min-w-0">
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{
              color: accent,
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            Coach noticed
          </div>
          <div
            className="text-[14px] leading-snug mt-0.5"
            style={{ fontWeight: 600 }}
          >
            {s.title}
          </div>
          <div
            className="text-[12.5px] mt-1 leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            {s.body}
          </div>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 leading-none px-1 -mr-1 -mt-0.5"
          style={{ color: "var(--muted)" }}
          aria-label="Dismiss"
        >
          <Icon name="plus" size={14} className="rotate-45" />
        </button>
      </div>
      <div
        className="px-4 pb-3 flex gap-2 ml-10"
        style={{ paddingLeft: 53 }}
      >
        <button
          onClick={apply}
          className="text-[12.5px] px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          style={{
            background: accent,
            color: "#FBFAF6",
            fontWeight: 700,
          }}
        >
          <Icon name="check-circle" size={12} strokeWidth={2.2} />
          Yes, apply
        </button>
        <button
          onClick={discuss}
          className="text-[12.5px] px-3 py-1.5 rounded-lg"
          style={{
            background: "var(--surface-alt)",
            color: "var(--foreground-soft)",
            fontWeight: 600,
          }}
        >
          Tell me more
        </button>
      </div>
    </section>
    </SwipeDismiss>
  );
}
