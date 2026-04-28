"use client";

// /recap — last 7 days at a glance. Spotify-Wrapped-style weekly hit.
// Pulls real data: adherence trend, streak, achievements unlocked,
// top items, total reactions, voice memos, intake totals.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";

type AdherenceDay = { date: string; taken: number; total: number };

type RecapData = {
  adherence: AdherenceDay[];
  totalTaken: number;
  totalSlots: number;
  reactionsCount: number;
  memosCount: number;
  newAchievements: number;
  topItem: { name: string; count: number } | null;
  thisWeekScore: number;
  lastWeekScore: number;
};

export default function RecapPage() {
  const [data, setData] = useState<RecapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const c = createClient();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today.getTime() - 7 * 86400000);
      const twoWeeksAgo = new Date(today.getTime() - 14 * 86400000);
      const since14 = twoWeeksAgo.toISOString().slice(0, 10);
      const since7 = weekAgo.toISOString().slice(0, 10);

      const [stackRes, rxRes, memosRes, achRes] = await Promise.all([
        c
          .from("stack_log")
          .select("date, taken, item_id, items(name)")
          .gte("date", since14),
        c.from("item_reactions").select("id").gte("reacted_on", since7),
        c
          .from("voice_memos")
          .select("id")
          .gte("created_at", weekAgo.toISOString()),
        c
          .from("achievements")
          .select("id, unlocked_at")
          .gte("unlocked_at", weekAgo.toISOString()),
      ]);

      // Build adherence map
      const byDate: Record<string, { taken: number; total: number }> = {};
      const itemCounts: Record<string, { name: string; count: number }> = {};

      type StackRow = {
        date: string;
        taken: boolean;
        item_id: string;
        items?: { name?: string } | null;
      };
      for (const row of (stackRes.data ?? []) as StackRow[]) {
        const d = row.date;
        if (!byDate[d]) byDate[d] = { taken: 0, total: 0 };
        byDate[d].total++;
        if (row.taken) {
          byDate[d].taken++;
          const name = row.items?.name ?? "(unknown)";
          if (!itemCounts[row.item_id])
            itemCounts[row.item_id] = { name, count: 0 };
          itemCounts[row.item_id].count++;
        }
      }

      const last7Days: AdherenceDay[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 86400000)
          .toISOString()
          .slice(0, 10);
        last7Days.push({
          date: d,
          taken: byDate[d]?.taken ?? 0,
          total: byDate[d]?.total ?? 0,
        });
      }

      const totalTaken = last7Days.reduce((s, d) => s + d.taken, 0);
      const totalSlots = last7Days.reduce((s, d) => s + d.total, 0);
      const thisWeekPct =
        totalSlots > 0 ? Math.round((totalTaken / totalSlots) * 100) : 0;

      // Compute last week's pct for delta
      let lastTaken = 0;
      let lastTotal = 0;
      for (let i = 13; i >= 7; i--) {
        const d = new Date(today.getTime() - i * 86400000)
          .toISOString()
          .slice(0, 10);
        lastTaken += byDate[d]?.taken ?? 0;
        lastTotal += byDate[d]?.total ?? 0;
      }
      const lastWeekPct =
        lastTotal > 0 ? Math.round((lastTaken / lastTotal) * 100) : 0;

      const top = Object.values(itemCounts).sort(
        (a, b) => b.count - a.count,
      )[0];

      setData({
        adherence: last7Days,
        totalTaken,
        totalSlots,
        reactionsCount: (rxRes.data ?? []).length,
        memosCount: (memosRes.data ?? []).length,
        newAchievements: (achRes.data ?? []).length,
        topItem: top ?? null,
        thisWeekScore: thisWeekPct,
        lastWeekScore: lastWeekPct,
      });
    } finally {
      setLoading(false);
    }
  }

  const delta = useMemo(
    () =>
      data ? data.thisWeekScore - data.lastWeekScore : 0,
    [data],
  );

  return (
    <div className="pb-24 max-w-2xl mx-auto">
      <header className="mb-7">
        <div
          className="text-[11px] uppercase tracking-wider mb-2"
          style={{
            color: "var(--accent)",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          This week
        </div>
        <h1
          className="text-[36px] leading-tight"
          style={{ fontWeight: 700, letterSpacing: "-0.025em" }}
        >
          Your{" "}
          <span
            style={{
              background:
                "linear-gradient(135deg, var(--accent) 0%, var(--accent-deep) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            recap
          </span>
        </h1>
        <p
          className="text-[14px] mt-2 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Last 7 days at a glance.
        </p>
      </header>

      {loading || !data ? (
        <div
          className="text-[13px] text-center py-12"
          style={{ color: "var(--muted)" }}
        >
          Crunching numbers…
        </div>
      ) : data.totalSlots === 0 ? (
        <div className="rounded-2xl card-glass p-8 text-center">
          <div className="text-[15px] mb-1" style={{ fontWeight: 500 }}>
            No data yet
          </div>
          <div
            className="text-[12px] leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            Come back at the end of the week — we&apos;ll have your stats.
          </div>
          <Link
            href="/today"
            className="inline-block mt-4 text-[13px] px-4 py-2 rounded-xl"
            style={{
              background: "var(--accent)",
              color: "#FBFAF6",
              fontWeight: 500,
            }}
          >
            Go to Today →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Headline stat */}
          <section
            className="rounded-2xl p-6"
            style={{
              background:
                "linear-gradient(135deg, var(--accent) 0%, var(--accent-deep) 100%)",
              color: "#FBFAF6",
              boxShadow: "0 12px 32px var(--accent-glow)",
            }}
          >
            <div
              className="text-[10px] uppercase tracking-wider mb-2"
              style={{
                opacity: 0.78,
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              Adherence
            </div>
            <div className="flex items-baseline gap-2">
              <span
                className="text-[56px] tabular-nums leading-none"
                style={{ fontWeight: 700, letterSpacing: "-0.03em" }}
              >
                {data.thisWeekScore}
              </span>
              <span className="text-[20px]" style={{ opacity: 0.85 }}>
                %
              </span>
              {delta !== 0 && (
                <span
                  className="text-[14px] tabular-nums ml-2 px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(251, 250, 246, 0.20)",
                    fontWeight: 700,
                  }}
                >
                  {delta > 0 ? "↑" : "↓"} {Math.abs(delta)}%
                </span>
              )}
            </div>
            <div
              className="text-[13px] mt-2"
              style={{ opacity: 0.85 }}
            >
              {data.totalTaken} of {data.totalSlots} items checked off
            </div>
            {/* 7-day mini bars */}
            <div className="flex items-end gap-1.5 h-12 mt-4">
              {data.adherence.map((d) => {
                const pct =
                  d.total > 0 ? Math.max(8, (d.taken / d.total) * 48) : 4;
                const dayLabel = new Date(d.date).toLocaleDateString(
                  undefined,
                  { weekday: "narrow" },
                );
                return (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div
                      className="w-full rounded-sm"
                      style={{
                        height: `${pct}px`,
                        background: "rgba(251, 250, 246, 0.85)",
                        opacity: d.total > 0 ? 1 : 0.3,
                      }}
                    />
                    <span
                      className="text-[9px]"
                      style={{ opacity: 0.7 }}
                    >
                      {dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Stat row */}
          <section className="grid grid-cols-3 gap-2">
            <RecapStat
              label="Reactions"
              value={String(data.reactionsCount)}
              accent="var(--accent)"
            />
            <RecapStat
              label="Voice memos"
              value={String(data.memosCount)}
              accent="var(--premium)"
            />
            <RecapStat
              label="Achievements"
              value={`+${data.newAchievements}`}
              accent="var(--pro)"
              link={data.newAchievements > 0 ? "/achievements" : undefined}
            />
          </section>

          {/* Top item */}
          {data.topItem && (
            <section className="rounded-2xl card-glass p-4 flex items-center gap-3">
              <span
                className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center"
                style={{
                  background: "var(--accent-tint)",
                  color: "var(--accent)",
                }}
              >
                <Icon name="award" size={18} strokeWidth={1.7} />
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className="text-[10px] uppercase tracking-wider"
                  style={{
                    color: "var(--muted)",
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                  }}
                >
                  Most consistent
                </div>
                <div className="text-[15px]" style={{ fontWeight: 600 }}>
                  {data.topItem.name}
                </div>
                <div
                  className="text-[12px]"
                  style={{ color: "var(--muted)" }}
                >
                  Taken {data.topItem.count} times this week
                </div>
              </div>
            </section>
          )}

          {/* Reflection prompt */}
          <section
            className="rounded-2xl p-4"
            style={{
              background: "var(--pro-tint)",
              border: "1px solid var(--pro-tint)",
            }}
          >
            <div
              className="text-[10px] uppercase tracking-wider mb-1"
              style={{
                color: "var(--pro)",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              Sunday reflection
            </div>
            <div
              className="text-[14px] leading-snug"
              style={{ fontWeight: 500 }}
            >
              {delta > 5
                ? "You're up. Keep this momentum going next week."
                : delta < -5
                  ? "Tougher week. What got in the way? Run a refinement."
                  : "Steady. The compound is working — just keep showing up."}
            </div>
            <Link
              href="/insights"
              className="text-[12px] mt-2 inline-flex items-center gap-1"
              style={{
                color: "var(--pro)",
                fontWeight: 600,
                textDecoration: "underline",
              }}
            >
              Run a refinement
              <Icon name="chevron-right" size={11} strokeWidth={2} />
            </Link>
          </section>
        </div>
      )}
    </div>
  );
}

function RecapStat({
  label,
  value,
  accent,
  link,
}: {
  label: string;
  value: string;
  accent: string;
  link?: string;
}) {
  const inner = (
    <div className="rounded-2xl card-glass p-4 text-center">
      <div
        className="text-[28px] tabular-nums leading-none"
        style={{
          color: accent,
          fontWeight: 700,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        className="text-[11px] mt-1.5"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </div>
    </div>
  );
  if (link) {
    return (
      <Link href={link} className="pressable block">
        {inner}
      </Link>
    );
  }
  return inner;
}
