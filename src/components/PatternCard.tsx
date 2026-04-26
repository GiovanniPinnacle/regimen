"use client";

// PatternCard — surfaces high-signal patterns Claude would flag, computed
// via cheap heuristics (no Claude call). Stolen from Bearable's factor-
// correlation tile pattern. Visible on /today.

import { useEffect, useState } from "react";
import Link from "next/link";

type Pattern = {
  kind: "worse" | "drop_candidate" | "adherence" | "repeat_skip" | "streak_win";
  severity: "urgent" | "high" | "medium" | "low";
  item_id: string;
  item_name: string;
  headline: string;
  detail: string;
};

const SEVERITY_STYLES: Record<
  Pattern["severity"],
  { bg: string; border: string; emoji: string; label: string }
> = {
  urgent: {
    bg: "rgba(176, 0, 32, 0.06)",
    border: "1px solid rgba(176, 0, 32, 0.25)",
    emoji: "⚠️",
    label: "Urgent",
  },
  high: {
    bg: "rgba(194, 145, 66, 0.08)",
    border: "1px solid rgba(194, 145, 66, 0.25)",
    emoji: "↓",
    label: "Drop signal",
  },
  medium: {
    bg: "var(--surface-alt)",
    border: "1px solid var(--border)",
    emoji: "•",
    label: "Pattern",
  },
  low: {
    bg: "var(--olive-tint)",
    border: "1px solid rgba(123, 139, 90, 0.25)",
    emoji: "✓",
    label: "Working",
  },
};

export default function PatternCard() {
  const [patterns, setPatterns] = useState<Pattern[] | null>(null);
  const [hasData, setHasData] = useState(true);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

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
        setHasData(data.has_data ?? false);
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

  if (loading) return null;
  if (!patterns) return null;
  if (patterns.length === 0) return null;

  const top = patterns[0];
  const rest = patterns.slice(1);
  const topStyle = SEVERITY_STYLES[top.severity];

  return (
    <section
      className="rounded-2xl mb-4 overflow-hidden"
      style={{ background: topStyle.bg, border: topStyle.border }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full p-4 text-left flex items-start gap-3"
      >
        <div className="text-[18px] leading-none mt-0.5">
          {topStyle.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
            <span
              className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
              style={{
                background: "rgba(0,0,0,0.05)",
                color: "var(--muted)",
                fontWeight: 600,
                letterSpacing: "0.06em",
              }}
            >
              {topStyle.label}
            </span>
            {patterns.length > 1 && (
              <span
                className="text-[11px]"
                style={{ color: "var(--muted)" }}
              >
                + {patterns.length - 1} more
              </span>
            )}
          </div>
          <div
            className="text-[14px] leading-snug"
            style={{ fontWeight: 500 }}
          >
            {top.headline}
          </div>
          <div
            className="text-[12px] mt-1 leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            {top.detail}
          </div>
        </div>
        {patterns.length > 1 && (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              color: "var(--muted)",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
              flexShrink: 0,
              marginTop: "2px",
            }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </button>

      {expanded && rest.length > 0 && (
        <div className="px-4 pb-4 flex flex-col gap-2">
          {rest.map((p, i) => {
            const s = SEVERITY_STYLES[p.severity];
            return (
              <Link
                key={`${p.item_id}-${p.kind}-${i}`}
                href={`/items/${p.item_id}`}
                className="rounded-xl p-3 flex items-start gap-2"
                style={{
                  background: "rgba(255,255,255,0.4)",
                  border: "1px solid var(--border)",
                }}
              >
                <span
                  className="text-[14px] leading-none mt-0.5"
                  style={{ color: "var(--muted)" }}
                >
                  {s.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[13px] leading-snug"
                    style={{ fontWeight: 500 }}
                  >
                    {p.headline}
                  </div>
                  <div
                    className="text-[11px] mt-0.5 leading-relaxed"
                    style={{ color: "var(--muted)" }}
                  >
                    {p.detail}
                  </div>
                </div>
              </Link>
            );
          })}

          <Link
            href="/refine"
            className="text-[12px] text-center mt-1 px-3 py-2 rounded-xl"
            style={{
              color: "var(--olive)",
              background: "rgba(255,255,255,0.4)",
              fontWeight: 500,
              textDecoration: "underline",
            }}
          >
            Run full refinement with Claude →
          </Link>
        </div>
      )}
    </section>
  );
}
