"use client";

// MagicMomentPrompt — auto-trigger on /today after the user has 3+ days
// of stack_log activity. The activation event that turns "another tracker"
// into "this app actually reads my data."
//
// Two paths now:
//  - "Quick refinement" — fires Coach with a focused prompt + send:true,
//    so the user gets a one-tap-approvable proposal in seconds. This is
//    the action-first path the user asked for.
//  - "Full reveal" — routes to /welcome, the animated first-refinement
//    experience for users who want the moment.

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";

const DISMISS_KEY = "regimen.magic_moment.dismissed.v1";
const SEEN_KEY = "regimen.magic_moment.last_run.v1";

export default function MagicMomentPrompt() {
  const [show, setShow] = useState(false);
  const [daysWithLogs, setDaysWithLogs] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Honor dismissal (90-day cooldown — re-prompt later if they have
      // way more data and never ran it)
      try {
        const dismissed = localStorage.getItem(DISMISS_KEY);
        if (dismissed) {
          const t = parseInt(dismissed, 10);
          if (Date.now() - t < 90 * 86400000) return;
        }
      } catch {}

      // Don't re-prompt if user ran a refine in the last 7 days
      try {
        const seen = localStorage.getItem(SEEN_KEY);
        if (seen) {
          const t = parseInt(seen, 10);
          if (Date.now() - t < 7 * 86400000) return;
        }
      } catch {}

      // Need 3+ unique days of stack_log
      const since = new Date(Date.now() - 14 * 86400000)
        .toISOString()
        .slice(0, 10);
      const client = createClient();
      const { data } = await client
        .from("stack_log")
        .select("date")
        .gte("date", since);
      if (!alive) return;
      const uniqueDays = new Set(
        (data ?? []).map((r) => r.date as string),
      );
      setDaysWithLogs(uniqueDays.size);
      if (uniqueDays.size >= 3) setShow(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setShow(false);
  }

  function fireCoach() {
    try {
      localStorage.setItem(SEEN_KEY, String(Date.now()));
    } catch {}
    const prompt =
      `I have ${daysWithLogs} days of stack_log data. Run a quick refinement: ` +
      `audit my last 14 days of skips and reactions, find the single most-likely ` +
      `drop candidate, and propose the change in <<<PROPOSAL ... PROPOSAL>>> format ` +
      `so I can approve it in one tap.`;
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: prompt, send: true },
      }),
    );
    setShow(false);
  }

  if (!show) return null;

  return (
    <section
      className="rounded-2xl mb-6 overflow-hidden relative px-5 py-4"
      style={{
        background:
          "linear-gradient(135deg, var(--olive) 0%, var(--olive-deep) 100%)",
        color: "#FBFAF6",
        boxShadow: "0 8px 24px var(--accent-glow)",
      }}
    >
      <div className="flex items-start gap-3 pr-7">
        <span className="shrink-0 mt-0.5">
          <Icon name="sparkle" size={18} strokeWidth={1.7} />
        </span>
        <div className="flex-1 min-w-0">
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{
              opacity: 0.78,
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            Ready
          </div>
          <div
            className="text-[15px] leading-snug mt-0.5"
            style={{ fontWeight: 600 }}
          >
            Run your first refinement
          </div>
          <div
            className="text-[12px] mt-1 leading-relaxed"
            style={{ opacity: 0.85 }}
          >
            You&apos;ve logged {daysWithLogs} days. Coach can read your patterns
            and tell you what to drop. Takes 15 seconds.
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3 ml-9">
        <button
          onClick={fireCoach}
          className="text-[12.5px] px-3.5 py-2 rounded-lg flex items-center gap-1.5"
          style={{
            background: "rgba(251, 250, 246, 0.96)",
            color: "var(--olive-deep)",
            fontWeight: 700,
          }}
        >
          <Icon name="check-circle" size={13} strokeWidth={2.2} />
          Run refinement
        </button>
        <Link
          href="/welcome"
          onClick={() => {
            try {
              localStorage.setItem(SEEN_KEY, String(Date.now()));
            } catch {}
          }}
          className="text-[12.5px] px-3 py-2 rounded-lg"
          style={{
            background: "rgba(251, 250, 246, 0.18)",
            color: "#FBFAF6",
            fontWeight: 600,
          }}
        >
          See full reveal
        </Link>
      </div>
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 leading-none px-1"
        style={{ color: "rgba(251, 250, 246, 0.7)" }}
        aria-label="Dismiss"
      >
        <Icon name="plus" size={14} className="rotate-45" />
      </button>
    </section>
  );
}
