"use client";

// Insights banner — Claude's surfaced "notes for today" (day milestones,
// cycle flips, biotin pause warnings, etc.). Tap to chat about one or all.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";

type Insight = {
  id: string;
  type: string;
  title: string;
  body: string;
  confidence: string;
  status: string;
  created_at: string;
};

type IconName = Parameters<typeof Icon>[0]["name"];

// Map insight types to clean line icons + accent colors. Replaces emoji.
const TYPE_META: Record<
  string,
  { icon: IconName; accent: string }
> = {
  day_milestone: { icon: "calendar", accent: "var(--olive)" },
  cycle_flip: { icon: "refresh", accent: "var(--olive)" },
  biotin_pause: { icon: "alert", accent: "var(--warn)" },
  daily_suggestion: { icon: "sparkle", accent: "var(--olive)" },
  reorder_alert: { icon: "shopping-bag", accent: "var(--warn)" },
};
const DEFAULT_META = { icon: "sparkle" as IconName, accent: "var(--olive)" };

export default function InsightsBanner() {
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    (async () => {
      const client = createClient();
      const { data } = await client
        .from("insights")
        .select("*")
        .eq("status", "new")
        .order("created_at", { ascending: false });
      setInsights((data ?? []) as Insight[]);
    })();
  }, []);

  async function dismiss(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    const client = createClient();
    await client.from("insights").update({ status: "dismissed" }).eq("id", id);
    setInsights((prev) => prev.filter((i) => i.id !== id));
  }

  function openInChat(insight: Insight) {
    const preface = insights
      .map((i) => `[${i.title}]\n${i.body}`)
      .join("\n\n");
    const initialPrompt = `Here's what's on my plate today:\n\n${preface}\n\n---\n\nLet's talk about: **${insight.title}**`;
    window.dispatchEvent(
      new CustomEvent("regimen:ask", { detail: { text: initialPrompt } }),
    );
  }

  if (insights.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2
          className="text-[11px] uppercase tracking-wider"
          style={{
            color: "var(--muted)",
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}
        >
          Notes from Claude
        </h2>
        <button
          onClick={() => {
            const preface = insights
              .map((i) => `[${i.title}]\n${i.body}`)
              .join("\n\n");
            window.dispatchEvent(
              new CustomEvent("regimen:ask", {
                detail: {
                  text: `Today's notes:\n\n${preface}\n\nLet's chat about this.`,
                },
              }),
            );
          }}
          className="text-[11px] flex items-center gap-1"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          Chat about all
          <Icon name="chevron-right" size={11} strokeWidth={2} />
        </button>
      </div>

      <div className="rounded-2xl card-glass overflow-hidden">
        {insights.map((i, idx) => {
          const meta = TYPE_META[i.type] ?? DEFAULT_META;
          return (
            <button
              key={i.id}
              onClick={() => openInChat(i)}
              className="w-full text-left flex items-start gap-3 px-4 py-3.5"
              style={{
                borderTop:
                  idx > 0 ? "1px solid var(--border)" : undefined,
              }}
            >
              <span
                className="shrink-0 mt-0.5"
                style={{ color: meta.accent }}
              >
                <Icon name={meta.icon} size={16} strokeWidth={1.7} />
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className="text-[14px] leading-snug"
                  style={{ fontWeight: 500 }}
                >
                  {i.title}
                </div>
                <div
                  className="text-[12px] mt-1 leading-relaxed whitespace-pre-line"
                  style={{ color: "var(--muted)" }}
                >
                  {i.body}
                </div>
              </div>
              <span
                onClick={(e) => dismiss(e, i.id)}
                className="shrink-0 leading-none cursor-pointer px-1.5 -mr-1.5"
                style={{ color: "var(--muted)" }}
                aria-label="Dismiss"
                role="button"
              >
                <Icon name="plus" size={14} className="rotate-45" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
