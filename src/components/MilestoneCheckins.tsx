"use client";

// MilestoneCheckins — the Coach memory loop's user-facing surface.
//
// One card at a time. The user answers Helped / No change / Worse, the
// next check-in slides into place. Pagination dots show "1 of 3"
// progress so the user knows what's coming. After the last one, the
// section vanishes.
//
// Why one-at-a-time: stacking 3 check-ins (or 5 insights, or 4
// patterns) trains users to skim past the section because it looks
// overwhelming. One card with a clear progress indicator stays
// focused and gets responses.

import { useEffect, useState } from "react";
import { setReaction } from "@/lib/storage";
import { showToast } from "@/lib/toast";
import { usePulseCount } from "@/components/CoachPulse";
import StepIndicator from "@/components/StepIndicator";
import CoachCardStack from "@/components/CoachCardStack";
import { CoachNoteCard } from "@/components/CoachCardStack";
import Button from "@/components/ui/Button";
import { openCoach } from "@/lib/coach-events";
import { REACTION_LABELS, type ReactionType } from "@/lib/types";

type Checkin = {
  item_id: string;
  item_name: string;
  item_type: string;
  brand: string | null;
  started_on: string;
  days_since_start: number;
  milestone: number;
  offset: number;
  last_reaction: string | null;
  last_reaction_on: string | null;
};

const REACTIONS: ReactionType[] = ["helped", "no_change", "worse"];


export default function MilestoneCheckins() {
  const [checkins, setCheckins] = useState<Checkin[] | null>(null);
  /** Item ids the user has already actioned this session — used to
   *  skip past them when the index lands on one. */
  const [acted, setActed] = useState<Set<string>>(new Set());
  /** Index into checkins for which one to show right now. We never
   *  decrement — once a card is answered/skipped, it's gone for the
   *  session. */
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/coach/milestone-checkins", {
          credentials: "include",
        });
        if (!r.ok) {
          if (alive) setCheckins([]);
          return;
        }
        const j = (await r.json()) as { checkins?: Checkin[] };
        if (alive) setCheckins(j.checkins ?? []);
      } catch {
        if (alive) setCheckins([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function advance() {
    setCursor((c) => c + 1);
  }

  async function react(c: Checkin, r: ReactionType) {
    setActed((prev) => new Set(prev).add(c.item_id));
    try {
      await setReaction(c.item_id, r);
      showToast(`${c.item_name}: ${REACTION_LABELS[r].toLowerCase()}`, {
        tone: r === "worse" ? "warn" : "success",
        duration: 2000,
      });
      // For "worse" especially, prompt Coach to investigate. This is
      // the highest-signal moment — a user just told us something
      // didn't work.
      if (r === "worse") {
        const prompt =
          `${c.item_name} (started ${c.days_since_start} days ago) — I just logged it as making things worse. ` +
          `What could be the issue? Look at my stack for interactions, dose, or timing problems and propose a fix. ` +
          `Use <<<PROPOSAL>>> blocks if you want to suggest a swap or dose change.`;
        openCoach({ text: prompt, send: true });
      }
      // Small delay before advancing so the user sees their tap
      // confirmed (the picked button stays highlighted briefly) before
      // the next card slides in.
      setTimeout(advance, 320);
    } catch (e) {
      console.error("Failed to save reaction", e);
      setActed((prev) => {
        const n = new Set(prev);
        n.delete(c.item_id);
        return n;
      });
      showToast("Couldn't save", { tone: "error" });
    }
  }

  function tellCoachMore(c: Checkin) {
    const prevContext =
      c.last_reaction && c.last_reaction_on
        ? `(I previously reacted "${c.last_reaction}" on ${c.last_reaction_on}.)`
        : "";
    const prompt =
      `Day-${c.milestone} check-in for **${c.item_name}**. I started it on ${c.started_on} (${c.days_since_start} days ago). ${prevContext}\n\n` +
      `Walk me through what to look for at this milestone. What changes should I notice if it's working? What if it isn't? Should I keep going, adjust dose, or try something else?`;
    openCoach({ text: prompt });
  }

  // Pulse badge counts only the checkins still pending response.
  const liveCount = (checkins ?? []).filter(
    (c) => !acted.has(c.item_id),
  ).length;
  usePulseCount("checkins", liveCount);

  if (!checkins || checkins.length === 0) return null;
  if (cursor >= checkins.length) return null;

  const c = checkins[cursor];
  const total = checkins.length;
  const dayLabel =
    c.offset === 0
      ? `Day ${c.milestone}`
      : c.offset > 0
        ? `Day ${c.milestone} +${c.offset}`
        : `Day ${c.milestone} −${Math.abs(c.offset)}`;
  const userReacted = acted.has(c.item_id);
  const lastSaid =
    c.last_reaction && REACTION_LABELS[c.last_reaction as ReactionType]
      ? ` · last: ${REACTION_LABELS[c.last_reaction as ReactionType].toLowerCase()}`
      : "";

  return (
    <section className="mb-4">
      <CoachCardStack
        current={cursor}
        total={total}
        onAdvance={advance}
        swipeDisabled={userReacted}
      >
        <CoachNoteCard
          icon="calendar"
          tone="neutral"
          eyebrow={`${dayLabel} check-in${lastSaid}`}
          meta={<StepIndicator current={cursor} total={total} />}
          title={<>How&apos;s {c.item_name} going?</>}
          body={
            c.brand
              ? `${c.brand} · started ${c.days_since_start} days ago`
              : `Started ${c.days_since_start} days ago`
          }
          dimmed={userReacted}
          onDismiss={total > 1 && !userReacted ? advance : undefined}
          dismissLabel="Not sure yet — skip"
          actionsFull
          actions={
            <div className="w-full">
              <div className="grid grid-cols-3 gap-2">
                {REACTIONS.map((r) => (
                  <Button
                    key={r}
                    size="md"
                    variant="secondary"
                    disabled={userReacted}
                    onClick={() => react(c, r)}
                    className="px-2!"
                  >
                    {REACTION_LABELS[r]}
                  </Button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => tellCoachMore(c)}
                className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-footnote font-medium text-[var(--pro-soft)]"
              >
                What should I look for at day {c.milestone}?
              </button>
            </div>
          }
        />
      </CoachCardStack>
    </section>
  );
}
