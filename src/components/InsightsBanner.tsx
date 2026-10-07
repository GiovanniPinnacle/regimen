"use client";

// InsightsBanner — Coach's notes for today (day milestones, cycle flips,
// reorder alerts, daily suggestions) from the `insights` table. One note
// at a time: the primary action hands the note to Coach to turn into a
// one-tap proposal; "Tell me more" opens a discussion; dismiss / swipe
// marks it dismissed.
//
// Copy for a type only appears when an insight of that type exists, so
// item-specific notes (e.g. a biotin pause before bloodwork) never show
// for users without that data.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { type IconName } from "@/components/Icon";
import Button from "@/components/ui/Button";
import { usePulseCount } from "@/components/CoachPulse";
import StepIndicator from "@/components/StepIndicator";
import CoachCardStack, { CoachNoteCard, type NoteTone } from "@/components/CoachCardStack";
import { openCoach } from "@/lib/coach-events";

type Insight = {
  id: string;
  type: string;
  title: string;
  body: string;
  created_at: string;
};

const TYPE_META: Record<
  string,
  { icon: IconName; tone: NoteTone; eyebrow: string; verb: string }
> = {
  day_milestone: { icon: "calendar", tone: "neutral", eyebrow: "Milestone", verb: "Review with Coach" },
  cycle_flip: { icon: "refresh", tone: "neutral", eyebrow: "Cycle change", verb: "Apply change" },
  biotin_pause: { icon: "alert", tone: "warn", eyebrow: "Before bloodwork", verb: "Plan the pause" },
  daily_suggestion: { icon: "sparkle", tone: "coach", eyebrow: "Suggestion", verb: "Apply" },
  reorder_alert: { icon: "shopping-bag", tone: "premium", eyebrow: "Running low", verb: "Add to shopping list" },
};
const DEFAULT_META = {
  icon: "sparkle" as IconName,
  tone: "coach" as NoteTone,
  eyebrow: "Coach noticed",
  verb: "Apply",
};

/** Drop repeat notes (same type + title) — the daily job can re-emit. */
function dedupe(list: Insight[]): Insight[] {
  const seen = new Set<string>();
  return list.filter((i) => {
    const k = `${i.type}|${i.title.trim().toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export default function InsightsBanner() {
  const [insights, setInsights] = useState<Insight[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await createClient()
        .from("insights")
        .select("id, type, title, body, created_at")
        .eq("status", "new")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) console.error("InsightsBanner: insights", error);
      if (alive) setInsights(dedupe((data ?? []) as Insight[]));
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function setStatus(id: string, status: "dismissed" | "applied") {
    setInsights((prev) => prev.filter((i) => i.id !== id));
    const { error } = await createClient()
      .from("insights")
      .update({ status })
      .eq("id", id);
    if (error) console.error("InsightsBanner: update", error);
  }

  function apply(insight: Insight) {
    void setStatus(insight.id, "applied");
    openCoach({
      text:
        `Take action on this note and propose the specific change(s) as one-tap proposals I can approve.\n\n` +
        `**${insight.title}**\n${insight.body}\n\n` +
        `Generate ONLY the minimum changes needed, in <<<PROPOSAL ... PROPOSAL>>> format. If no concrete change is needed, confirm in one sentence.`,
      send: true,
    });
  }

  function discuss(insight: Insight) {
    openCoach({
      text:
        `Tell me more about this:\n\n**${insight.title}**\n${insight.body}\n\n` +
        `Help me decide what to do — only propose changes if I ask.`,
    });
  }

  usePulseCount("insights", insights.length);
  if (insights.length === 0) return null;

  const current = insights[0];
  const meta = TYPE_META[current.type] ?? DEFAULT_META;

  return (
    <section className="mb-4">
      <CoachCardStack
        current={0}
        total={insights.length}
        onAdvance={() => void setStatus(current.id, "dismissed")}
      >
        <CoachNoteCard
          icon={meta.icon}
          tone={meta.tone}
          eyebrow={meta.eyebrow}
          meta={<StepIndicator current={0} total={insights.length} />}
          title={current.title}
          body={current.body}
          onDismiss={() => void setStatus(current.id, "dismissed")}
          actions={
            <>
              <Button size="md" variant="primary" onClick={() => apply(current)}>
                {meta.verb}
              </Button>
              <Button size="md" variant="secondary" onClick={() => discuss(current)}>
                Tell me more
              </Button>
            </>
          }
        />
      </CoachCardStack>
    </section>
  );
}
