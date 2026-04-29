"use client";

// Insights banner — Coach's surfaced "notes for today" (day milestones,
// cycle flips, biotin pause warnings, daily suggestions). Each insight is
// now truly actionable: tap "Apply" and Coach generates a one-tap proposal
// you approve in the Coach pane. No more dead-end suggestions.

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

// Map insight types to icon, accent color, and a tailored verb for the
// primary "Apply" action. Falls back to a generic verb if unknown.
const TYPE_META: Record<
  string,
  { icon: IconName; accent: string; verb: string }
> = {
  day_milestone: {
    icon: "calendar",
    accent: "var(--accent)",
    verb: "Acknowledge",
  },
  cycle_flip: {
    icon: "refresh",
    accent: "var(--accent)",
    verb: "Apply cycle change",
  },
  biotin_pause: {
    icon: "alert",
    accent: "var(--warn)",
    verb: "Pause biotin",
  },
  daily_suggestion: {
    icon: "sparkle",
    accent: "var(--pro)",
    verb: "Apply now",
  },
  reorder_alert: {
    icon: "shopping-bag",
    accent: "var(--premium)",
    verb: "Add to shopping list",
  },
};
const DEFAULT_META = {
  icon: "sparkle" as IconName,
  accent: "var(--accent)",
  verb: "Apply",
};

export default function InsightsBanner() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

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

  // Primary action — fire Coach with a pre-built "apply this" prompt.
  // Coach will generate a <<<PROPOSAL>>> block the user can approve in one
  // tap. Marks the insight as applied locally so the row dims while the
  // user is in Coach.
  async function applyInsight(insight: Insight) {
    setAppliedIds((s) => new Set(s).add(insight.id));
    const client = createClient();
    await client
      .from("insights")
      .update({ status: "applied" })
      .eq("id", insight.id);

    const prompt =
      `Take action on this insight from my Today screen and propose the specific change(s) as one-tap proposals I can approve.\n\n` +
      `**${insight.title}**\n${insight.body}\n\n` +
      `Generate ONLY the minimum changes needed. Use the <<<PROPOSAL ... PROPOSAL>>> format so I can approve them in one tap. If no concrete change is needed, just confirm in 1 sentence.`;

    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: prompt, send: true },
      }),
    );
  }

  function discussInsight(insight: Insight) {
    const prompt =
      `Tell me more about this:\n\n**${insight.title}**\n${insight.body}\n\n` +
      `Help me decide what to do — but only propose changes if I ask.`;
    window.dispatchEvent(
      new CustomEvent("regimen:ask", { detail: { text: prompt } }),
    );
  }

  const visible = insights.filter((i) => !appliedIds.has(i.id));
  if (visible.length === 0) return null;

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
          Notes from Coach
        </h2>
        <span
          className="text-[11px] tabular-nums"
          style={{ color: "var(--muted)" }}
        >
          {visible.length}
        </span>
      </div>

      <div className="rounded-2xl card-glass overflow-hidden">
        {visible.map((i, idx) => {
          const meta = TYPE_META[i.type] ?? DEFAULT_META;
          return (
            <div
              key={i.id}
              className="px-4 pt-3.5 pb-3"
              style={{
                borderTop: idx > 0 ? "1px solid var(--border)" : undefined,
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="shrink-0 mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center"
                  style={{
                    background: `${meta.accent}1F`,
                    color: meta.accent,
                  }}
                >
                  <Icon name={meta.icon} size={14} strokeWidth={1.8} />
                </span>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[14px] leading-snug"
                    style={{ fontWeight: 600 }}
                  >
                    {i.title}
                  </div>
                  <div
                    className="text-[12.5px] mt-1 leading-relaxed whitespace-pre-line"
                    style={{ color: "var(--muted)" }}
                  >
                    {i.body}
                  </div>
                </div>
                <button
                  onClick={(e) => dismiss(e, i.id)}
                  className="shrink-0 leading-none px-1.5 -mr-1.5 -mt-0.5"
                  style={{ color: "var(--muted)" }}
                  aria-label="Dismiss"
                >
                  <Icon name="plus" size={14} className="rotate-45" />
                </button>
              </div>
              <div className="flex gap-2 mt-3 ml-10">
                <button
                  onClick={() => applyInsight(i)}
                  className="text-[12.5px] px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                  style={{
                    background: meta.accent,
                    color: "#FBFAF6",
                    fontWeight: 600,
                  }}
                >
                  <Icon name="check-circle" size={12} strokeWidth={2.2} />
                  {meta.verb}
                </button>
                <button
                  onClick={() => discussInsight(i)}
                  className="text-[12.5px] px-3 py-1.5 rounded-lg"
                  style={{
                    background: "var(--surface-alt)",
                    color: "var(--foreground-soft)",
                  }}
                >
                  Tell me more
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
