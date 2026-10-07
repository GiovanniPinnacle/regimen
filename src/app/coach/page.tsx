"use client";

// /coach — Coach's notes and history. Not a tab any more: reached from
// You and from Today's "Coach has N notes" row. Chat itself is the
// Coach overlay (openCoach); this page is the hub around it:
//   1. Today's notes — check-ins, notes, ideas, picks, patterns. One
//      "all caught up" state when every surface is empty.
//   2. Suggested questions — one stage-aware set.
//   3. Recent conversations — tap to read the thread in history.

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/Section";
import { ListGroup } from "@/components/ui/ListRow";
import Icon from "@/components/Icon";
import InsightsBanner from "@/components/InsightsBanner";
import MilestoneCheckins from "@/components/MilestoneCheckins";
import PatternCard from "@/components/PatternCard";
import SmartSuggestions from "@/components/SmartSuggestions";
import CatalogPicks from "@/components/CatalogPicks";
import CoachQuickActions from "@/components/CoachQuickActions";
import { createClient } from "@/lib/supabase/client";
import { openCoach } from "@/lib/coach-events";

type ConversationRow = {
  id: string;
  created_at: string;
  messages_json: { user?: unknown; assistant?: unknown } | null;
};

type RecentChat = { id: string; question: string; answer: string; at: string };

/** Flatten a stored message (plain string or content blocks) to text. */
function messageText(j: unknown): string {
  if (typeof j === "string") return j;
  if (Array.isArray(j)) {
    return (j as Array<{ type?: string; text?: string }>)
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text!)
      .join(" ");
  }
  return "";
}

/** Strip markdown + proposal blocks for a one-line preview. */
function preview(t: string): string {
  return t
    .replace(/<<<PROPOSAL[\s\S]*?PROPOSAL>>>/g, "")
    .replace(/[*_#`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function relTime(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 1)
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Sum the pulse counts every note surface broadcasts, so the page can
 *  show one "all caught up" state instead of five empty sections. */
function useNoteCount(): { total: number; settled: boolean } {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    function onCount(e: Event) {
      const d = (e as CustomEvent<{ bucket: string; count: number }>).detail;
      if (!d) return;
      setCounts((prev) =>
        prev[d.bucket] === d.count ? prev : { ...prev, [d.bucket]: d.count },
      );
    }
    window.addEventListener("regimen:pulse-count", onCount);
    // Surfaces fetch independently; give them a moment before declaring
    // the inbox empty.
    const t = setTimeout(() => setSettled(true), 2500);
    return () => {
      window.removeEventListener("regimen:pulse-count", onCount);
      clearTimeout(t);
    };
  }, []);
  const total = Object.entries(counts)
    .filter(([k]) => k !== "next_step")
    .reduce((s, [, v]) => s + v, 0);
  return { total, settled };
}

export default function CoachPage() {
  const [recent, setRecent] = useState<RecentChat[] | null>(null);
  const notes = useNoteCount();

  useEffect(() => {
    let alive = true;
    (async () => {
      // One row per turn: messages_json = { user, assistant }.
      const { data, error } = await createClient()
        .from("claude_conversations")
        .select("id, created_at, messages_json")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) console.error("coach: claude_conversations", error);
      if (!alive) return;
      setRecent(
        ((data ?? []) as ConversationRow[])
          .map((r) => ({
            id: r.id,
            question: preview(messageText(r.messages_json?.user)),
            answer: preview(messageText(r.messages_json?.assistant)),
            at: r.created_at,
          }))
          .filter((c) => c.question || c.answer),
      );
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="pb-28">
      <PageHeader
        back="/you"
        backLabel="You"
        title="Coach"
        subtitle="Knows your stack and your data. Proposes — you approve."
        showCoach={false}
        actions={
          <Button
            variant="coach"
            size="md"
            icon="sparkle"
            onClick={() => openCoach({ newChat: true })}
          >
            New chat
          </Button>
        }
      />

      <SectionHeader
        className="mt-2"
        title="Today's notes"
        action={
          notes.total > 0 ? (
            <span className="text-footnote tabular-nums text-[var(--muted)]">
              {notes.total} {notes.total === 1 ? "note" : "notes"}
            </span>
          ) : undefined
        }
      />
      <div>
        <MilestoneCheckins />
        <InsightsBanner />
        <SmartSuggestions />
        <CatalogPicks />
        <PatternCard />
      </div>
      {notes.total === 0 && (
        <Card padding="lg" className="text-center">
          {notes.settled ? (
            <>
              <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-[14px] bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
                <Icon name="check" size={20} strokeWidth={2} />
              </span>
              <div className="text-title-3">You&apos;re all caught up</div>
              <p className="mx-auto mt-1 max-w-[280px] text-callout text-[var(--muted)]">
                Coach will leave a note here when something in your data is
                worth acting on.
              </p>
            </>
          ) : (
            <p className="text-callout text-[var(--muted)]">Checking for notes…</p>
          )}
        </Card>
      )}

      <CoachQuickActions title="Ask Coach" layout="list" />

      <SectionHeader
        title="Recent conversations"
        href={recent && recent.length > 0 ? "/coach-history" : undefined}
        hrefLabel="All"
      />
      {recent == null ? (
        <Card className="h-[160px] animate-pulse" />
      ) : recent.length === 0 ? (
        <Card padding="lg">
          <p className="text-callout text-[var(--muted)]">
            No conversations yet. Ask anything about your stack, sleep or
            labs — every answer is saved here.
          </p>
        </Card>
      ) : (
        <ListGroup>
          {recent.map((c) => (
            <Link
              key={c.id}
              href={`/coach-history#t-${c.id}`}
              className="flex min-h-[64px] items-start gap-3 px-4 py-3 transition-colors active:bg-[var(--surface-alt)]"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--pro-tint)] text-[var(--pro-soft)]">
                <Icon name="message" size={16} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-callout font-semibold">
                    {c.question || "Coach note"}
                  </span>
                  <span className="shrink-0 text-caption tabular-nums text-[var(--muted)]">
                    {relTime(c.at)}
                  </span>
                </span>
                {c.answer && (
                  <span className="mt-0.5 line-clamp-2 text-footnote text-[var(--muted)]">
                    {c.answer}
                  </span>
                )}
              </span>
            </Link>
          ))}
        </ListGroup>
      )}
    </div>
  );
}
