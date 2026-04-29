"use client";

// /insights — action-first refinement hub.
// Old design: long scrolling read-only display with audit button at bottom.
// New design: Hero audit card up top, "Audit lenses" chips for focused
// Coach prompts, then supporting metrics + reactions + memos. Every data
// section ends in a clear next action — never dead-end.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PatternCard from "@/components/PatternCard";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";

type IconName = Parameters<typeof Icon>[0]["name"];

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

type Lens = {
  label: string;
  icon: IconName;
  accent: string;
  prompt: string;
};

const LENSES: Lens[] = [
  {
    label: "What should I drop?",
    icon: "trend-down",
    accent: "var(--error)",
    prompt:
      "Audit my stack for items I should drop. Focus on items where I've reacted 'no change' 5+ times, 'worse' 2+ times, or skipped them entirely for 14+ days. Emit each drop as a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format with action: retire.",
  },
  {
    label: "What's slowing me down?",
    icon: "alert",
    accent: "var(--warn)",
    prompt:
      "Look at my last 14 days of skips, reactions, voice memos. What's the single biggest blocker? Give me ONE concrete fix and emit it as a proposal in <<<PROPOSAL ... PROPOSAL>>> format.",
  },
  {
    label: "Cut my costs",
    icon: "dollar",
    accent: "var(--premium)",
    prompt:
      "Look at my stack costs. Propose 2-3 swaps that save money WITHOUT losing efficacy. Cite mechanism, not brand. Emit each swap as a one-tap proposal.",
  },
  {
    label: "What pattern am I missing?",
    icon: "graph",
    accent: "var(--pro)",
    prompt:
      "Find ONE non-obvious correlation in my data (skips × reactions × notes). Don't propose anything yet — just make me think. End with one specific question to sharpen.",
  },
  {
    label: "What should I add?",
    icon: "plus",
    accent: "var(--accent)",
    prompt:
      "Based on my goals + current stack + recent reactions, what's the highest-leverage item I'm missing? If you don't have enough confidence, say so and tell me what data you'd need. Otherwise emit ONE add as a proposal.",
  },
];

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
      const d = new Date(Date.now() - i * 86400000)
        .toISOString()
        .slice(0, 10);
      adh.push({
        date: d,
        taken: byDate[d]?.taken ?? 0,
        total: byDate[d]?.total ?? 0,
      });
    }
    setAdherence(adh);

    const rxRes = await client
      .from("item_reactions")
      .select("item_id, reaction, items(name)")
      .gte("reacted_on", since30);
    const rxAgg = new Map<string, ReactionTop>();
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
    setTopReactions(
      Array.from(rxAgg.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 5),
    );

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

  function fireLens(lens: Lens) {
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: lens.prompt, send: true },
      }),
    );
  }

  const limitReached = usage.count >= FREE_DAILY_LIMIT;

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

  const totalReactions = topReactions.reduce((s, r) => s + r.total, 0);
  const dataIsThin = totalReactions < 5;

  return (
    <div className="pb-24">
      <header className="mb-6">
        <h1
          className="text-[32px] leading-tight"
          style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          Insights
        </h1>
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Audit your stack. Spot patterns. Decide what to drop.
        </p>
      </header>

      {/* Hero audit card */}
      <section
        className="rounded-2xl mb-5 overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, var(--pro) 0%, #6D28D9 100%)",
          color: "#FBFAF6",
          boxShadow: "0 12px 32px rgba(168, 85, 247, 0.30)",
        }}
      >
        <div className="px-5 py-4">
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{
              opacity: 0.85,
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            Coach audit · {usage.count}/{FREE_DAILY_LIMIT} runs today
          </div>
          <div
            className="text-[20px] leading-snug mt-1"
            style={{ fontWeight: 700 }}
          >
            {dataIsThin
              ? "Need more reactions first"
              : "Run a full audit"}
          </div>
          <p
            className="text-[12.5px] mt-1.5 leading-relaxed"
            style={{ opacity: 0.88 }}
          >
            {dataIsThin
              ? `Only ${totalReactions} reaction${totalReactions === 1 ? "" : "s"} so far. Tap helped/no-change/worse on a few items today and Coach will have enough signal to make confident calls.`
              : "Coach reads your last 30 days of skips, reactions, voice memos, and adherence — then proposes what to keep, drop, or swap."}
          </p>
          <button
            onClick={runAudit}
            disabled={loading || limitReached || dataIsThin}
            className="w-full mt-3 py-2.5 rounded-xl text-[13.5px] flex items-center justify-center gap-1.5"
            style={{
              background: "rgba(251, 250, 246, 0.96)",
              color: "var(--pro-deep)",
              fontWeight: 700,
              opacity: loading || limitReached || dataIsThin ? 0.55 : 1,
            }}
          >
            <Icon name="sparkle" size={13} strokeWidth={2.2} />
            {loading
              ? "Running audit… (15-25s)"
              : limitReached
                ? "Daily free limit reached"
                : dataIsThin
                  ? "Log more reactions first"
                  : memo
                    ? "Run again"
                    : "Run full audit"}
          </button>
          {limitReached && (
            <Link
              href="/upgrade"
              className="block w-full mt-2 py-2 rounded-xl text-center text-[12.5px]"
              style={{
                background: "rgba(251, 250, 246, 0.16)",
                color: "#FBFAF6",
                fontWeight: 600,
              }}
            >
              Unlimited audits with Pro →
            </Link>
          )}
        </div>
      </section>

      {/* Audit lenses — focused Coach prompts */}
      <section className="mb-7">
        <div className="flex items-baseline justify-between mb-2.5">
          <h2
            className="text-[11px] uppercase tracking-wider"
            style={{
              color: "var(--muted)",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            Audit lenses
          </h2>
          <span
            className="text-[11px]"
            style={{ color: "var(--muted)" }}
          >
            One tap → focused prompt
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {LENSES.map((l) => (
            <button
              key={l.label}
              onClick={() => fireLens(l)}
              className="text-left rounded-2xl p-3 card-glass active:scale-[0.98] transition-transform flex items-start gap-2.5"
            >
              <span
                className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center"
                style={{
                  background: `${l.accent}1F`,
                  color: l.accent,
                }}
              >
                <Icon name={l.icon} size={14} strokeWidth={1.8} />
              </span>
              <div className="flex-1 min-w-0 pt-0.5">
                <div
                  className="text-[13px] leading-snug"
                  style={{ fontWeight: 600 }}
                >
                  {l.label}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Audit memo — appears after Run full audit */}
      {memo && (
        <section className="mb-7">
          <div className="flex items-baseline justify-between mb-2.5">
            <h2
              className="text-[11px] uppercase tracking-wider"
              style={{
                color: "var(--accent)",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              Latest audit
            </h2>
            {generatedAt && (
              <span
                className="text-[11px]"
                style={{ color: "var(--muted)" }}
              >
                {new Date(generatedAt).toLocaleString()}
              </span>
            )}
          </div>
          <div
            className="rounded-2xl card-glass p-4 text-[13.5px] leading-relaxed whitespace-pre-line"
            style={{ color: "var(--foreground-soft)" }}
          >
            {memo}
          </div>
        </section>
      )}

      {err && (
        <div
          className="rounded-xl p-3 text-[12.5px] mb-7"
          style={{
            background: "rgba(239, 68, 68, 0.10)",
            color: "var(--error)",
            border: "1px solid rgba(239, 68, 68, 0.30)",
          }}
        >
          {err}
        </div>
      )}

      {/* Patterns from heuristics */}
      <section className="mb-7">
        <h2
          className="text-[11px] uppercase tracking-wider mb-2.5"
          style={{
            color: "var(--muted)",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          Patterns
        </h2>
        <PatternCard />
      </section>

      {/* Adherence trend */}
      <section className="mb-7">
        <div className="flex items-baseline justify-between mb-2.5">
          <h2
            className="text-[11px] uppercase tracking-wider"
            style={{
              color: "var(--muted)",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            Adherence
          </h2>
          {adherenceStats.delta !== 0 && (
            <span
              className="text-[11px] tabular-nums"
              style={{
                color:
                  adherenceStats.delta > 0
                    ? "var(--accent)"
                    : "var(--warn)",
                fontWeight: 600,
              }}
            >
              {adherenceStats.delta > 0 ? "↑" : "↓"}{" "}
              {Math.abs(Math.round(adherenceStats.delta * 100))}%
            </span>
          )}
        </div>
        <div className="rounded-2xl card-glass p-4">
          <div className="flex items-baseline gap-3 mb-3">
            <div
              className="text-[28px] tabular-nums leading-none"
              style={{
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color:
                  adherenceStats.last7Pct >= 0.8
                    ? "var(--accent)"
                    : adherenceStats.last7Pct >= 0.5
                      ? "var(--warn)"
                      : "var(--error)",
              }}
            >
              {Math.round(adherenceStats.last7Pct * 100)}
              <span className="text-[14px] ml-0.5" style={{ opacity: 0.65 }}>
                %
              </span>
            </div>
            <div
              className="text-[12px]"
              style={{ color: "var(--muted)" }}
            >
              7-day avg
            </div>
          </div>

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
                          ? "var(--accent)"
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
      </section>

      {/* Top reactions — each opens Coach focused on it */}
      {topReactions.length > 0 && (
        <section className="mb-7">
          <div className="flex items-baseline justify-between mb-2.5">
            <h2
              className="text-[11px] uppercase tracking-wider"
              style={{
                color: "var(--muted)",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              Top reactions
            </h2>
            <span
              className="text-[11px]"
              style={{ color: "var(--muted)" }}
            >
              Tap to discuss
            </span>
          </div>
          <div className="rounded-2xl card-glass overflow-hidden">
            {topReactions.map((r, i) => (
              <button
                key={r.item_id}
                onClick={() => {
                  const summary = [
                    r.helped > 0 ? `${r.helped} helped` : null,
                    r.no_change > 0 ? `${r.no_change} "no change"` : null,
                    r.worse > 0 ? `${r.worse} "worse"` : null,
                    r.forgot > 0 ? `${r.forgot} "forgot"` : null,
                  ]
                    .filter(Boolean)
                    .join(", ");
                  window.dispatchEvent(
                    new CustomEvent("regimen:ask", {
                      detail: {
                        text:
                          `Discuss ${r.item_name}. Reactions over the last 30 days: ${summary} (${r.total} total). ` +
                          `Should I keep, adjust, or drop? Be specific. If you'd propose a change, emit it in <<<PROPOSAL ... PROPOSAL>>> format.`,
                        send: true,
                      },
                    }),
                  );
                }}
                className="block w-full text-left p-3.5"
                style={{
                  borderTop: i > 0 ? "1px solid var(--border)" : undefined,
                }}
              >
                <div className="flex items-baseline justify-between gap-2 mb-1.5">
                  <div
                    className="text-[14px] truncate"
                    style={{ fontWeight: 600 }}
                  >
                    {r.item_name}
                  </div>
                  <div
                    className="text-[11px] shrink-0 tabular-nums"
                    style={{ color: "var(--muted)" }}
                  >
                    {r.total} {r.total === 1 ? "tap" : "taps"}
                  </div>
                </div>
                <div className="flex h-1.5 rounded-full overflow-hidden">
                  {r.helped > 0 && (
                    <div
                      style={{
                        width: `${(r.helped / r.total) * 100}%`,
                        background: "var(--accent)",
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
                  className="flex gap-3 mt-1.5 text-[11px] tabular-nums"
                  style={{ color: "var(--muted)" }}
                >
                  {r.helped > 0 && (
                    <span style={{ color: "var(--accent)" }}>
                      helped {r.helped}
                    </span>
                  )}
                  {r.no_change > 0 && (
                    <span style={{ color: "var(--warn)" }}>
                      no change {r.no_change}
                    </span>
                  )}
                  {r.worse > 0 && (
                    <span style={{ color: "var(--error)" }}>
                      worse {r.worse}
                    </span>
                  )}
                  {r.forgot > 0 && <span>forgot {r.forgot}</span>}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Voice memos */}
      {memos.length > 0 && (
        <section className="mb-7">
          <div className="flex items-baseline justify-between mb-2.5">
            <h2
              className="text-[11px] uppercase tracking-wider"
              style={{
                color: "var(--muted)",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              Voice memos · last 7 days
            </h2>
            <span
              className="text-[11px]"
              style={{ color: "var(--muted)" }}
            >
              {memos.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {memos.slice(0, 3).map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("regimen:ask", {
                      detail: {
                        text:
                          `Read this voice memo I left and tell me what to do about it.\n\n"${m.transcript}"\n\n` +
                          `If there's a concrete change implied, emit it as a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format.`,
                        send: true,
                      },
                    }),
                  );
                }}
                className="rounded-2xl card-glass p-3.5 text-left active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center gap-2 mb-1">
                  {m.context_tag && (
                    <span
                      className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{
                        background: "var(--accent-tint)",
                        color: "var(--accent)",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                      }}
                    >
                      {m.context_tag}
                    </span>
                  )}
                  <span
                    className="text-[10.5px]"
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
                  style={{ color: "var(--foreground-soft)" }}
                >
                  {m.transcript}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Bottom links */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/costs"
          className="rounded-2xl card-glass p-3.5 flex items-center gap-2.5"
        >
          <span
            className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
            style={{
              background: "var(--premium-tint)",
              color: "var(--premium)",
            }}
          >
            <Icon name="dollar" size={15} strokeWidth={1.8} />
          </span>
          <div className="flex-1 min-w-0">
            <div
              className="text-[13px]"
              style={{ fontWeight: 600 }}
            >
              Costs
            </div>
            <div
              className="text-[11px]"
              style={{ color: "var(--muted)" }}
            >
              Run-rate + savings
            </div>
          </div>
          <Icon
            name="chevron-right"
            size={14}
            className="shrink-0 opacity-50"
          />
        </Link>
        <Link
          href="/recap"
          className="rounded-2xl card-glass p-3.5 flex items-center gap-2.5"
        >
          <span
            className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center"
            style={{
              background: "var(--accent-tint)",
              color: "var(--accent)",
            }}
          >
            <Icon name="graph" size={15} strokeWidth={1.8} />
          </span>
          <div className="flex-1 min-w-0">
            <div
              className="text-[13px]"
              style={{ fontWeight: 600 }}
            >
              Weekly recap
            </div>
            <div
              className="text-[11px]"
              style={{ color: "var(--muted)" }}
            >
              Last 7 days
            </div>
          </div>
          <Icon
            name="chevron-right"
            size={14}
            className="shrink-0 opacity-50"
          />
        </Link>
      </div>
    </div>
  );
}
