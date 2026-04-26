"use client";

// /insights — the broader "what's working / what's not" surface.
// Replaces /refine in the bottom nav. Refine (Claude audit) is now ONE
// section here, alongside heuristic patterns, adherence trend, reactions
// summary, voice memos, costs preview.
//
// Frequency-of-visit fits a daily-to-weekly cadence — a real peer of
// Today / Stack / Protocols / More.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PatternCard from "@/components/PatternCard";
import { createClient } from "@/lib/supabase/client";
import { getReactionsSummary } from "@/lib/storage";

const FREE_DAILY_LIMIT = 1;
const USAGE_KEY = "regimen.refine.usage.v1";

type Usage = { date: string; count: number };

function readUsage(): Usage {
  if (typeof window === "undefined") return { date: "", count: 0 };
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return { date: "", count: 0 };
    const parsed = JSON.parse(raw) as Usage;
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date !== today) return { date: today, count: 0 };
    return parsed;
  } catch {
    return { date: "", count: 0 };
  }
}

function writeUsage(u: Usage) {
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(u));
  } catch {}
}

type AdherenceDay = { date: string; taken: number; total: number };
type ReactionTop = {
  item_id: string;
  item_name: string;
  helped: number;
  no_change: number;
  worse: number;
  forgot: number;
  total: number;
};
type VoiceMemo = {
  id: string;
  transcript: string;
  context_tag: string | null;
  created_at: string;
};

export default function InsightsPage() {
  const [adherence, setAdherence] = useState<AdherenceDay[]>([]);
  const [topReactions, setTopReactions] = useState<ReactionTop[]>([]);
  const [memos, setMemos] = useState<VoiceMemo[]>([]);
  const [memo, setMemo] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage>({ date: "", count: 0 });

  useEffect(() => {
    setUsage(readUsage());
    void load();
  }, []);

  async function load() {
    const client = createClient();
    const since14 = new Date(Date.now() - 14 * 86400000)
      .toISOString()
      .slice(0, 10);
    const since30 = new Date(Date.now() - 30 * 86400000)
      .toISOString()
      .slice(0, 10);

    // Adherence over last 14 days (rollup by date)
    const stackRes = await client
      .from("stack_log")
      .select("date, taken")
      .gte("date", since14);
    const byDate: Record<string, { taken: number; total: number }> = {};
    for (const row of stackRes.data ?? []) {
      const d = row.date as string;
      if (!byDate[d]) byDate[d] = { taken: 0, total: 0 };
      byDate[d].total++;
      if (row.taken) byDate[d].taken++;
    }
    const adh: AdherenceDay[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      adh.push({
        date: d,
        taken: byDate[d]?.taken ?? 0,
        total: byDate[d]?.total ?? 0,
      });
    }
    setAdherence(adh);

    // Reactions aggregated per item over 30 days
    const rxRes = await client
      .from("item_reactions")
      .select("item_id, reaction, items(name)")
      .gte("reacted_on", since30);
    const rxAgg = new Map<
      string,
      ReactionTop
    >();
    for (const row of rxRes.data ?? []) {
      const r = row as {
        item_id: string;
        reaction: string;
        items?: { name?: string } | null;
      };
      const id = r.item_id;
      if (!rxAgg.has(id)) {
        rxAgg.set(id, {
          item_id: id,
          item_name: r.items?.name ?? "(unknown)",
          helped: 0,
          no_change: 0,
          worse: 0,
          forgot: 0,
          total: 0,
        });
      }
      const a = rxAgg.get(id)!;
      if (r.reaction === "helped") a.helped++;
      else if (r.reaction === "no_change") a.no_change++;
      else if (r.reaction === "worse") a.worse++;
      else if (r.reaction === "forgot") a.forgot++;
      a.total++;
    }
    const sortedRx = Array.from(rxAgg.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    setTopReactions(sortedRx);

    // Voice memos — last 7 days
    const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
    const memosRes = await client
      .from("voice_memos")
      .select("id, transcript, context_tag, created_at")
      .gte("created_at", since7)
      .order("created_at", { ascending: false })
      .limit(5);
    setMemos((memosRes.data ?? []) as VoiceMemo[]);
  }

  async function runAudit() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/refine", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      const data = await res.json();
      setMemo(data.memo);
      setGeneratedAt(data.generated_at);
      const today = new Date().toISOString().slice(0, 10);
      const next = { date: today, count: usage.count + 1 };
      setUsage(next);
      writeUsage(next);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const limitReached = usage.count >= FREE_DAILY_LIMIT;

  // Compute adherence stats
  const adherenceStats = useMemo(() => {
    const last7 = adherence.slice(-7);
    const prev7 = adherence.slice(0, 7);
    const sum = (arr: AdherenceDay[], k: keyof AdherenceDay) =>
      arr.reduce((s, d) => s + (d[k] as number), 0);
    const last7Pct =
      sum(last7, "total") > 0 ? sum(last7, "taken") / sum(last7, "total") : 0;
    const prev7Pct =
      sum(prev7, "total") > 0 ? sum(prev7, "taken") / sum(prev7, "total") : 0;
    return { last7Pct, prev7Pct, delta: last7Pct - prev7Pct };
  }, [adherence]);

  const maxAdherenceTotal = useMemo(
    () => Math.max(1, ...adherence.map((d) => d.total)),
    [adherence],
  );

  return (
    <div className="pb-24">
      <header className="mb-6">
        <h1 className="text-[28px] leading-tight" style={{ fontWeight: 500 }}>
          Insights
        </h1>
        <p
          className="text-[14px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          What's working. What's not. What to drop.
        </p>
      </header>

      {/* Patterns from your data */}
      <Section title="Patterns" subtitle="From your reactions, skips, and streaks">
        <PatternCard />
      </Section>

      {/* Adherence trend */}
      <Section
        title="Adherence"
        subtitle={
          adherenceStats.delta !== 0
            ? `Last 7 days vs prior 7 — ${adherenceStats.delta > 0 ? "↑" : "↓"} ${Math.abs(Math.round(adherenceStats.delta * 100))}%`
            : "Last 14 days"
        }
      >
        <div className="rounded-2xl card-glass p-4">
          <div className="flex items-baseline gap-3 mb-3">
            <div
              className="text-[28px] tabular-nums"
              style={{
                fontWeight: 600,
                color:
                  adherenceStats.last7Pct >= 0.8
                    ? "var(--olive)"
                    : adherenceStats.last7Pct >= 0.5
                      ? "var(--warn)"
                      : "var(--error)",
              }}
            >
              {Math.round(adherenceStats.last7Pct * 100)}
              <span className="text-[14px]" style={{ opacity: 0.65 }}>
                %
              </span>
            </div>
            <div
              className="text-[12px]"
              style={{ color: "var(--muted)" }}
            >
              7-day average
            </div>
          </div>

          {/* Sparkline of bars */}
          <div className="flex items-end gap-1 h-12 mb-1">
            {adherence.map((d) => {
              const h =
                d.total > 0
                  ? Math.max(8, (d.taken / d.total) * 48)
                  : 4;
              const today =
                d.date === new Date().toISOString().slice(0, 10);
              return (
                <div
                  key={d.date}
                  className="flex-1 rounded-sm relative"
                  style={{
                    height: `${h}px`,
                    background:
                      d.total === 0
                        ? "var(--border)"
                        : d.taken / d.total >= 0.8
                          ? "var(--olive)"
                          : d.taken / d.total >= 0.5
                            ? "var(--warn)"
                            : "var(--error)",
                    opacity: today ? 1 : 0.7,
                    minHeight: "4px",
                  }}
                  title={`${d.date}: ${d.taken}/${d.total}`}
                />
              );
            })}
          </div>
          <div
            className="flex justify-between text-[10px]"
            style={{ color: "var(--muted)" }}
          >
            <span>14d ago</span>
            <span>today</span>
          </div>
        </div>
      </Section>

      {/* Reactions */}
      {topReactions.length > 0 && (
        <Section
          title="Reactions"
          subtitle="Top 5 items you've rated, last 30 days"
        >
          <div className="rounded-2xl card-glass overflow-hidden">
            {topReactions.map((r, i) => (
              <Link
                key={r.item_id}
                href={`/items/${r.item_id}`}
                className="block p-3"
                style={{
                  borderTop:
                    i > 0 ? "1px solid var(--border)" : undefined,
                }}
              >
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <div
                    className="text-[14px] truncate"
                    style={{ fontWeight: 500 }}
                  >
                    {r.item_name}
                  </div>
                  <div
                    className="text-[11px] shrink-0"
                    style={{ color: "var(--muted)" }}
                  >
                    {r.total} {r.total === 1 ? "tap" : "taps"}
                  </div>
                </div>
                {/* Tiny bar chart of reactions */}
                <div className="flex h-1.5 rounded-full overflow-hidden">
                  {r.helped > 0 && (
                    <div
                      style={{
                        width: `${(r.helped / r.total) * 100}%`,
                        background: "var(--olive)",
                      }}
                    />
                  )}
                  {r.no_change > 0 && (
                    <div
                      style={{
                        width: `${(r.no_change / r.total) * 100}%`,
                        background: "var(--warn)",
                      }}
                    />
                  )}
                  {r.worse > 0 && (
                    <div
                      style={{
                        width: `${(r.worse / r.total) * 100}%`,
                        background: "var(--error)",
                      }}
                    />
                  )}
                  {r.forgot > 0 && (
                    <div
                      style={{
                        width: `${(r.forgot / r.total) * 100}%`,
                        background: "var(--border-strong)",
                      }}
                    />
                  )}
                </div>
                <div
                  className="flex gap-3 mt-1.5 text-[10px]"
                  style={{ color: "var(--muted)" }}
                >
                  {r.helped > 0 && <span>👍 {r.helped}</span>}
                  {r.no_change > 0 && <span>✋ {r.no_change}</span>}
                  {r.worse > 0 && <span>👎 {r.worse}</span>}
                  {r.forgot > 0 && <span>❓ {r.forgot}</span>}
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* Voice memos */}
      {memos.length > 0 && (
        <Section
          title="Voice memos"
          subtitle={`${memos.length} memo${memos.length === 1 ? "" : "s"} this week`}
        >
          <div className="flex flex-col gap-2">
            {memos.slice(0, 3).map((m) => (
              <div
                key={m.id}
                className="rounded-2xl card-glass p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  {m.context_tag && (
                    <span
                      className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                      style={{
                        background: "var(--olive-tint)",
                        color: "var(--olive)",
                        fontWeight: 600,
                        letterSpacing: "0.06em",
                      }}
                    >
                      {m.context_tag}
                    </span>
                  )}
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--muted)" }}
                  >
                    {new Date(m.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div
                  className="text-[13px] leading-relaxed line-clamp-3"
                  style={{ color: "var(--foreground)", opacity: 0.85 }}
                >
                  {m.transcript}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Claude audit */}
      <Section
        title="Full Claude audit"
        subtitle={`${usage.count}/${FREE_DAILY_LIMIT} runs used today`}
      >
        <button
          onClick={runAudit}
          disabled={loading || limitReached}
          className="w-full rounded-2xl px-5 py-4 text-[15px]"
          style={{
            background: limitReached ? "var(--surface-alt)" : "var(--olive)",
            color: limitReached ? "var(--muted)" : "#FBFAF6",
            fontWeight: 500,
            opacity: loading ? 0.6 : 1,
            boxShadow: limitReached
              ? undefined
              : "0 4px 14px rgba(74, 82, 48, 0.25)",
          }}
        >
          {loading
            ? "Running audit… (15-25s)"
            : limitReached
              ? "Daily free limit reached"
              : memo
                ? "Run again →"
                : "Run full Claude audit →"}
        </button>

        {limitReached && (
          <div
            className="mt-3 rounded-2xl p-4"
            style={{
              background:
                "linear-gradient(135deg, rgba(107, 91, 205, 0.10) 0%, rgba(107, 91, 205, 0.04) 100%)",
              border: "1px solid rgba(107, 91, 205, 0.25)",
            }}
          >
            <div
              className="text-[11px] uppercase tracking-wider mb-1"
              style={{ color: "var(--purple)", fontWeight: 600 }}
            >
              Pro
            </div>
            <div
              className="text-[14px] leading-snug"
              style={{ fontWeight: 500 }}
            >
              Want unlimited refinements?
            </div>
            <div
              className="text-[12px] mt-1 leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              Pro = unlimited Claude audits, deep research, photo analysis, and
              5% rebate on items ordered through Regimen. $9/mo or $79/yr.
            </div>
            <button
              className="mt-3 text-[13px] px-3.5 py-2 rounded-xl"
              style={{
                background: "var(--purple)",
                color: "#FBFAF6",
                fontWeight: 500,
              }}
              onClick={() =>
                alert("Pro tier launches with Stripe — coming soon.")
              }
            >
              Upgrade to Pro →
            </button>
          </div>
        )}

        {err && (
          <div
            className="mt-3 rounded-lg p-3 text-[13px]"
            style={{
              background: "rgba(176, 0, 32, 0.08)",
              color: "var(--error)",
            }}
          >
            {err}
          </div>
        )}

        {memo && (
          <div className="mt-4">
            {generatedAt && (
              <div
                className="text-[11px] mb-2"
                style={{ color: "var(--muted)" }}
              >
                Generated {new Date(generatedAt).toLocaleString()}
              </div>
            )}
            <div className="rounded-2xl card-glass p-5 text-[14px] leading-relaxed whitespace-pre-line">
              {memo}
            </div>
          </div>
        )}
      </Section>

      {/* Costs preview link */}
      <Section title="Costs">
        <Link
          href="/costs"
          className="block rounded-2xl card-glass p-4 pressable"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div
                className="text-[14px] leading-snug"
                style={{ fontWeight: 500 }}
              >
                Stack run-rate + savings
              </div>
              <div
                className="text-[12px] mt-0.5"
                style={{ color: "var(--muted)" }}
              >
                Monthly cost · expensive items · Claude's drop savings estimate
              </div>
            </div>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "var(--muted)", flexShrink: 0 }}
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </div>
        </Link>
      </Section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-7">
      <div className="mb-2.5">
        <h2
          className="text-[11px] uppercase tracking-wider"
          style={{ color: "var(--muted)", fontWeight: 600, letterSpacing: "0.06em" }}
        >
          {title}
        </h2>
        {subtitle && (
          <div
            className="text-[12px] mt-0.5"
            style={{ color: "var(--muted)", opacity: 0.7 }}
          >
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}
