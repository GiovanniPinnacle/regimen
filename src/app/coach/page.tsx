"use client";

// /coach — the destination tab for the AI coach. Three zones:
//   1. Pulse summary — what Coach has noticed today (insights,
//      milestone check-ins, suggestions, patterns)
//   2. Lenses — focused prompts ("What should I drop?", "What's
//      slowing me down?") that fire Coach with structured context
//   3. Recent conversations — the last 8 chats Coach has had with
//      the user, tap to resume
//
// Tapping anywhere "ask" opens the same Coach overlay that the FAB
// triggers — single conversation surface, multiple entry points.

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import InsightsBanner from "@/components/InsightsBanner";
import MilestoneCheckins from "@/components/MilestoneCheckins";
import PatternCard from "@/components/PatternCard";
import SmartSuggestions from "@/components/SmartSuggestions";
import CatalogPicks from "@/components/CatalogPicks";
import { createClient } from "@/lib/supabase/client";

type IconName = Parameters<typeof Icon>[0]["name"];

const LENSES: Array<{
  label: string;
  icon: IconName;
  accent: string;
  prompt: string;
}> = [
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
      "Look at my last 14 days of skips, reactions, voice memos. What's the single biggest blocker right now? Give me ONE concrete fix and emit it as a proposal in <<<PROPOSAL ... PROPOSAL>>> format.",
  },
  {
    label: "What should I add?",
    icon: "sparkle",
    accent: "var(--pro)",
    prompt:
      "Based on my goals, current stack, and recent reactions — what's the single most-impactful item to add right now? Emit as a proposal in <<<PROPOSAL ... PROPOSAL>>> format with action: add.",
  },
  {
    label: "How am I tracking?",
    icon: "graph",
    accent: "var(--accent)",
    prompt:
      "Walk me through my last 30 days. Adherence trends, what helped, what I dropped, what's slipping. End with one focused recommendation.",
  },
];

type RecentChat = {
  id: string;
  first_message: string | null;
  last_message: string | null;
  message_count: number;
  updated_at: string;
};

export default function CoachPage() {
  const [recent, setRecent] = useState<RecentChat[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const client = createClient();
      const { data } = await client
        .from("coach_conversations")
        .select("id, first_message, last_message, message_count, updated_at")
        .order("updated_at", { ascending: false })
        .limit(8);
      if (alive) setRecent((data ?? []) as RecentChat[]);
    })();
    return () => {
      alive = false;
    };
  }, []);

  function fireLens(prompt: string) {
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: prompt, send: true },
      }),
    );
  }

  function startNewChat() {
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: "", send: false },
      }),
    );
  }

  return (
    <div className="pb-24">
      <header className="mb-5 flex items-start justify-between gap-2">
        <div>
          <h1
            className="text-[32px] leading-tight"
            style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
          >
            Coach
          </h1>
          <p
            className="text-[12.5px] mt-1 leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            Knows your stack. Proposes — you approve.
          </p>
        </div>
        <button
          onClick={startNewChat}
          className="shrink-0 px-3 py-2 rounded-xl flex items-center gap-1.5"
          style={{
            background: "var(--pro)",
            color: "#FBFAF6",
            fontWeight: 700,
            minHeight: 36,
            fontSize: 13,
          }}
        >
          <Icon name="sparkle" size={12} strokeWidth={2.4} />
          New chat
        </button>
      </header>

      {/* Lenses — focused prompts, one tap fires Coach with full
          context. The fastest path from "I have a question" to "Coach
          is answering with my data in context." */}
      <section className="mb-6">
        <h2
          className="text-[11px] uppercase tracking-wider mb-2 px-0.5"
          style={{
            color: "var(--muted)",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          Ask Coach
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {LENSES.map((l) => (
            <button
              key={l.label}
              onClick={() => fireLens(l.prompt)}
              className="rounded-2xl card-glass p-3.5 text-left flex flex-col gap-1.5"
              style={{ minHeight: 88 }}
            >
              <span
                className="h-7 w-7 rounded-lg flex items-center justify-center"
                style={{
                  background: `${l.accent}1F`,
                  color: l.accent,
                }}
              >
                <Icon name={l.icon} size={14} strokeWidth={1.8} />
              </span>
              <span
                className="text-[13px] leading-snug"
                style={{ fontWeight: 600 }}
              >
                {l.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Coach's notes today — same surfaces from the old CoachPulse
          but now first-class on the Coach tab. Each renders as
          one-at-a-time deck-of-cards. Returns null when nothing fresh. */}
      <section className="mb-6">
        <h2
          className="text-[11px] uppercase tracking-wider mb-2 px-0.5"
          style={{
            color: "var(--muted)",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          Today&apos;s notes
        </h2>
        <MilestoneCheckins />
        <InsightsBanner />
        <SmartSuggestions />
        <CatalogPicks />
        <PatternCard />
      </section>

      {/* Recent conversations — last 8 chats. Tap to resume. */}
      {recent && recent.length > 0 && (
        <section className="mb-6">
          <div className="flex items-baseline justify-between mb-2 px-0.5">
            <h2
              className="text-[11px] uppercase tracking-wider"
              style={{
                color: "var(--muted)",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              Recent · {recent.length}
            </h2>
            <Link
              href="/coach-history"
              className="text-[11px]"
              style={{ color: "var(--accent)" }}
            >
              All →
            </Link>
          </div>
          <div className="flex flex-col gap-1.5">
            {recent.map((c) => (
              <Link
                key={c.id}
                href={`/coach-history?id=${c.id}`}
                className="rounded-xl card-glass px-3 py-2.5"
              >
                <div
                  className="text-[13px] leading-snug line-clamp-2"
                  style={{ fontWeight: 500 }}
                >
                  {c.first_message ?? "(empty)"}
                </div>
                <div
                  className="flex items-baseline gap-2 mt-1 text-[11px]"
                  style={{ color: "var(--muted)" }}
                >
                  <span className="tabular-nums">
                    {new Date(c.updated_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span>·</span>
                  <span>{c.message_count} messages</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
