"use client";

// SmartSuggestions — one proactive pairing / topping / consolidation /
// slot-move idea from /api/coach/suggestions (heuristics first, Coach
// fallback). Apply hands it to Coach for a one-tap proposal; dismiss
// mutes it for 7 days on this device.

import { useEffect, useState } from "react";
import { type IconName } from "@/components/Icon";
import Button from "@/components/ui/Button";
import SwipeDismiss from "@/components/SwipeDismiss";
import { usePulseCount } from "@/components/CoachPulse";
import { CoachNoteCard } from "@/components/CoachCardStack";
import { openCoach } from "@/lib/coach-events";

type Suggestion = {
  id: string;
  kind: "pair" | "topping" | "consolidate" | "move_slot";
  title: string;
  body: string;
  apply_prompt: string;
  item_ids?: string[];
};

const KIND_META: Record<Suggestion["kind"], { icon: IconName; eyebrow: string }> = {
  pair: { icon: "link", eyebrow: "Pair these" },
  topping: { icon: "utensils", eyebrow: "Easy add-on" },
  consolidate: { icon: "list-ordered", eyebrow: "Simplify" },
  move_slot: { icon: "clock", eyebrow: "Better timing" },
};

const DISMISS_KEY_PREFIX = "regimen.smart_suggestion.dismissed.v1.";

function mute(id: string) {
  try {
    localStorage.setItem(`${DISMISS_KEY_PREFIX}${id}`, String(Date.now()));
  } catch {}
}

export default function SmartSuggestions() {
  const [s, setS] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/coach/suggestions");
        if (!res.ok) return;
        const data = await res.json();
        const sug = data.suggestion as Suggestion | null;
        if (!alive || !sug) return;
        try {
          const at = localStorage.getItem(`${DISMISS_KEY_PREFIX}${sug.id}`);
          if (at && Date.now() - parseInt(at, 10) < 7 * 86400000) return;
        } catch {}
        setS(sug);
      } catch {
        // offline — nothing to suggest
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function dismiss() {
    if (!s) return;
    mute(s.id);
    setS(null);
  }

  function apply() {
    if (!s) return;
    openCoach({ text: s.apply_prompt, send: true });
    mute(s.id);
    setS(null);
  }

  function discuss() {
    if (!s) return;
    openCoach({
      text: `Talk me through this idea before I apply it:\n\n**${s.title}**\n${s.body}\n\nWhat's the trade-off? Anything to watch for?`,
    });
  }

  usePulseCount("suggestions", !loading && s ? 1 : 0);
  if (loading || !s) return null;
  const meta = KIND_META[s.kind] ?? KIND_META.pair;

  return (
    <section className="mb-4">
      <SwipeDismiss onDismiss={dismiss}>
        <CoachNoteCard
          icon={meta.icon}
          tone="coach"
          eyebrow={meta.eyebrow}
          title={s.title}
          body={s.body}
          onDismiss={dismiss}
          actions={
            <>
              <Button size="md" variant="primary" onClick={apply}>
                Apply
              </Button>
              <Button size="md" variant="secondary" onClick={discuss}>
                Tell me more
              </Button>
            </>
          }
        />
      </SwipeDismiss>
    </section>
  );
}
