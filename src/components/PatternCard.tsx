"use client";

// PatternCard — surfaces high-signal patterns Claude would flag, computed
// via cheap heuristics (no Claude call). Stolen from Bearable's factor-
// correlation tile pattern. Visible on /today.

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";

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
  {
    accent: string;
    icon: "alert" | "trend-down" | "graph" | "award";
    label: string;
  }
> = {
  urgent: {
    accent: "var(--error)",
    icon: "alert",
    label: "Urgent",
  },
  high: {
    accent: "var(--warn)",
    icon: "trend-down",
    label: "Drop signal",
  },
  medium: {
    accent: "var(--muted)",
    icon: "graph",
    label: "Pattern",
  },
  low: {
    accent: "var(--olive)",
    icon: "award",
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
    <section className="rounded-2xl card-glass mb-6 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3.5 text-left flex items-start gap-3"
      >
        <span
          className="shrink-0 mt-0.5"
          style={{ color: topStyle.accent }}
        >
          <Icon name={topStyle.icon} size={18} strokeWidth={1.7} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <span
              className="text-[10px] uppercase tracking-wider"
              style={{
                color: topStyle.accent,
                fontWeight: 600,
                letterSpacing: "0.08em",
              }}
            >
              {topStyle.label}
            </span>
            {patterns.length > 1 && (
              <span
                className="text-[11px]"
                style={{ color: "var(--muted)" }}
              >
                +{patterns.length - 1} more
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
          <Icon
            name="chevron-down"
            size={16}
            className="shrink-0 mt-1 transition-transform"
          />
        )}
      </button>

      {expanded && rest.length > 0 && (
        <div
          className="px-4 pb-3 flex flex-col"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {rest.map((p, i) => {
            const s = SEVERITY_STYLES[p.severity];
            return (
              <Link
                key={`${p.item_id}-${p.kind}-${i}`}
                href={`/items/${p.item_id}`}
                className="py-3 flex items-start gap-3"
                style={{
                  borderBottom:
                    i < rest.length - 1
                      ? "1px solid var(--border)"
                      : undefined,
                }}
              >
                <span
                  className="shrink-0 mt-0.5"
                  style={{ color: s.accent }}
                >
                  <Icon name={s.icon} size={14} strokeWidth={1.7} />
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
                <Icon
                  name="chevron-right"
                  size={14}
                  className="shrink-0 opacity-40 mt-1"
                />
              </Link>
            );
          })}

          <Link
            href="/refine"
            className="text-[12px] text-center mt-2 mb-1 py-2 flex items-center justify-center gap-1.5"
            style={{
              color: "var(--olive)",
              fontWeight: 500,
            }}
          >
            Run full Claude audit
            <Icon name="chevron-right" size={12} strokeWidth={2} />
          </Link>
        </div>
      )}
    </section>
  );
}
