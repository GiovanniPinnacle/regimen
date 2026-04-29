"use client";

// ProtocolCompletionModal — peak dopamine moment.
//
// Fires once per protocol completion (tracked via localStorage key
// "regimen.protocol.celebrated.v1.<slug>"). Renders a full-screen modal
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

  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-5"
      style={{ background: "rgba(0, 0, 0, 0.72)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Protocol complete"
    >
      <div
        className="rounded-3xl max-w-md w-full overflow-hidden relative"
        style={{
          background:
            "linear-gradient(135deg, var(--premium) 0%, var(--premium-deep) 100%)",
          color: "#FBFAF6",
          boxShadow: "0 24px 48px var(--premium-glow)",
        }}
      >
        {/* Close X */}
        <button
          onClick={close}
          className="absolute top-3 right-3 leading-none p-1.5 rounded-full"
          style={{
            background: "rgba(0, 0, 0, 0.18)",
            color: "#FBFAF6",
          }}
          aria-label="Close"
        >
          <Icon name="plus" size={16} className="rotate-45" />
        </button>

        <div className="px-6 pt-7 pb-6">
          <div className="flex items-center justify-center mb-3">
            <span
              className="h-16 w-16 rounded-2xl flex items-center justify-center"
              style={{
                background: "rgba(251, 250, 246, 0.18)",
                color: "#FBFAF6",
              }}
            >
              <Icon name="award" size={32} strokeWidth={1.6} />
            </span>
          </div>
          <div
            className="text-[10px] uppercase tracking-wider text-center"
            style={{
              opacity: 0.85,
              fontWeight: 700,
              letterSpacing: "0.12em",
            }}
          >
            Protocol complete
          </div>
          <h2
            className="text-[28px] leading-tight text-center mt-1.5"
            style={{ fontWeight: 700, letterSpacing: "-0.02em" }}
          >
            You finished{" "}
            <span style={{ textTransform: "capitalize" }}>
              {humanizeSlug(active.slug)}
            </span>
          </h2>
          <p
            className="text-[14px] mt-2 leading-relaxed text-center"
            style={{ opacity: 0.92 }}
          >
            {active.duration_days} days. That&apos;s consistency most people
            never hit. Now decide what to keep — Coach can run the analysis
            in 15 seconds.
          </p>

          <div className="flex flex-col gap-2 mt-5">
            <button
              onClick={applyLearnings}
              className="w-full py-3 rounded-xl text-[14px] flex items-center justify-center gap-1.5"
              style={{
                background: "rgba(251, 250, 246, 0.96)",
                color: "var(--premium-deep)",
                fontWeight: 700,
              }}
            >
              <Icon name="sparkle" size={14} strokeWidth={2.2} />
              Apply learnings now
            </button>
            <button
              onClick={close}
              className="w-full py-2.5 rounded-xl text-[13px]"
              style={{
                background: "rgba(251, 250, 246, 0.18)",
                color: "#FBFAF6",
                fontWeight: 600,
              }}
            >
              I&apos;ll decide later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function humanizeSlug(s: string): string {
  return s.replace(/-/g, " ");
}
