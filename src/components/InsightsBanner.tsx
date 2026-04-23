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
  morning_checkin: "☀️",
  day_milestone: "🎯",
  cycle_flip: "🔄",
  biotin_pause: "⚠️",
  default: "💡",
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

  async function dismiss(id: string) {
    const client = createClient();
    await client.from("insights").update({ status: "dismissed" }).eq("id", id);
    setInsights((prev) => prev.filter((i) => i.id !== id));
  }

  if (insights.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mb-6">
      {insights.map((i) => {
        const icon = TYPE_ICONS[i.type] ?? TYPE_ICONS.default;
        return (
          <div
            key={i.id}
            className="border-hair rounded-xl p-4"
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
                </div>
              </div>
              <button
                onClick={() => dismiss(i.id)}
                className="shrink-0 text-[18px] leading-none"
                style={{ color: "var(--muted)" }}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
