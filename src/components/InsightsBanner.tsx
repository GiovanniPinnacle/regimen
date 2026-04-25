"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Insight = {
  id: string;
  type: string;
  title: string;
  body: string;
  confidence: string;
  status: string;
  created_at: string;
};

const TYPE_ICONS: Record<string, string> = {
  day_milestone: "🎯",
  cycle_flip: "🔄",
  biotin_pause: "⚠️",
  daily_suggestion: "💡",
  reorder_alert: "📦",
  default: "🔔",
};

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
    // Bundle all new insights as context for the chat
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
    <div className="flex flex-col gap-2 mb-6">
      <div className="flex items-center justify-between mb-1">
        <div
          className="text-[11px] uppercase tracking-wider"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          Today&apos;s notes from Claude
        </div>
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
          className="text-[11px]"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          Chat about all →
        </button>
      </div>

      {insights.map((i) => {
        const icon = TYPE_ICONS[i.type] ?? TYPE_ICONS.default;
        return (
          <button
            key={i.id}
            onClick={() => openInChat(i)}
            className="border-hair rounded-xl p-4 text-left w-full transition-colors active:scale-[0.99]"
            style={{ background: "var(--surface-alt)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3 min-w-0 flex-1">
                <div className="text-[18px] leading-none shrink-0">{icon}</div>
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[14px] leading-snug"
                    style={{ fontWeight: 500 }}
                  >
                    {i.title}
                  </div>
                  <div
                    className="text-[13px] mt-1 whitespace-pre-line"
                    style={{ color: "var(--muted)" }}
                  >
                    {i.body}
                  </div>
                  <div
                    className="text-[11px] mt-2"
                    style={{ color: "var(--muted)", fontWeight: 500 }}
                  >
                    Tap to chat →
                  </div>
                </div>
              </div>
              <span
                onClick={(e) => dismiss(e, i.id)}
                className="shrink-0 text-[18px] leading-none cursor-pointer select-none px-1"
                style={{ color: "var(--muted)" }}
                aria-label="Dismiss"
              >
                ×
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
