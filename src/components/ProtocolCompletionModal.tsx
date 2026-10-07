"use client";

// ProtocolCompletionModal — peak dopamine moment.
//
// Fires once per protocol completion (tracked via localStorage key
// "regimen.protocol.celebrated.v1.<slug>"). Renders a bottom Sheet
// with confetti, headline, two clear actions:
//   1. "Apply learnings" → fires Coach with a focused prompt to keep/
//      drop/cycle each protocol item, emitting one-tap proposals
//   2. "I'll decide later" → soft dismiss, modal won't re-fire
//
// Mounted on /today next to NextStep, runs once on mount, checks
// localStorage + signals before opening. Doesn't compete with NextStep —
// the modal IS the celebration; NextStep keeps showing the milestone
// step until learnings are applied.

import { useEffect, useState } from "react";
import { fireConfetti } from "@/lib/confetti";
import Icon from "@/components/Icon";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Section";
import type { UserSignals } from "@/lib/context";

const STORAGE_KEY = "regimen.protocol.celebrated.v1";

type CompletedProtocol = {
  slug: string;
  current_day: number;
  duration_days: number;
};

export default function ProtocolCompletionModal() {
  const [active, setActive] = useState<CompletedProtocol | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/user-state");
        if (!res.ok) return;
        const data = (await res.json()) as { signals: UserSignals };
        if (!alive) return;
        const completed = data.signals.activeProtocols.find((p) => p.completed);
        if (!completed) return;
        // Have we already celebrated this one?
        const dismissedKey = `${STORAGE_KEY}.${completed.slug}`;
        try {
          if (localStorage.getItem(dismissedKey)) return;
        } catch {}
        setActive(completed);
        // Fire confetti on next paint so it doesn't blow up the initial render
        setTimeout(() => fireConfetti({ count: 56 }), 150);
        setTimeout(() => fireConfetti({ count: 36 }), 700);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  function close() {
    if (!active) return;
    try {
      localStorage.setItem(`${STORAGE_KEY}.${active.slug}`, String(Date.now()));
    } catch {}
    setActive(null);
  }

  function applyLearnings() {
    if (!active) return;
    const prompt =
      `I just completed the protocol "${active.slug}" — Day ${active.current_day} of ${active.duration_days}. ` +
      `Look at my last ${active.duration_days} days of skips, reactions, and voice memos for items in this protocol. ` +
      `For each item, decide: KEEP (move to permanent), DROP (retire), or CYCLE (set review_trigger to revisit later). ` +
      `Emit each decision as a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format.`;
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: prompt, send: true },
      }),
    );
    close();
  }

  return (
    <Sheet
      open={!!active}
      onClose={close}
      footer={
        <div className="flex flex-col gap-2">
          <Button variant="coach" size="lg" icon="sparkle" fullWidth onClick={applyLearnings}>
            Apply learnings now
          </Button>
          <Button variant="ghost" size="md" fullWidth onClick={close}>
            I&apos;ll decide later
          </Button>
        </div>
      }
    >
      {active && (
        <div className="pt-2 pb-2 text-center">
          <div className="mb-3 flex justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[var(--success-tint)] text-[var(--success)]">
              <Icon name="award" size={32} strokeWidth={1.6} />
            </span>
          </div>
          <Eyebrow>Protocol complete</Eyebrow>
          <h2 className="mt-1.5 text-title-1">
            You finished{" "}
            <span className="capitalize">{humanizeSlug(active.slug)}</span>
          </h2>
          <p className="mt-2 text-callout text-[var(--foreground-soft)]">
            {active.duration_days} days. That&apos;s consistency most people
            never hit. Now decide what to keep — Coach can run the analysis
            in 15 seconds.
          </p>
        </div>
      )}
    </Sheet>
  );
}

function humanizeSlug(s: string): string {
  return s.replace(/-/g, " ");
}
