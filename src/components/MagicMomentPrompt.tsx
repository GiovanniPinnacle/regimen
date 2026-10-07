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
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";
import Card from "@/components/ui/Card";
import Button, { ButtonLink, IconButton } from "@/components/ui/Button";
import { addDaysISO, localDateISO } from "@/lib/series";

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
      const since = addDaysISO(localDateISO(), -14);
      const client = createClient();
      const { data, error } = await client
        .from("stack_log")
        .select("date")
        .gte("date", since);
      if (error) console.error("MagicMomentPrompt: stack_log", error);
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
    <Card tone="coach" padding="md" className="relative mb-6">
      <div className="flex items-start gap-3 pr-8">
        <span className="mt-0.5 shrink-0 text-[var(--pro-soft)]">
          <Icon name="sparkle" size={18} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-body font-semibold">Ready for your first review</div>
          <p className="mt-1 text-footnote text-[var(--foreground-soft)]">
            You&apos;ve logged {daysWithLogs} days. Coach can look at your
            patterns and suggest what to drop.
          </p>
        </div>
      </div>
      <div className="mt-3 ml-[30px] flex flex-wrap gap-2">
        <Button variant="coach" size="sm" onClick={fireCoach} className="min-h-[44px]">
          Review now
        </Button>
        <ButtonLink
          href="/welcome"
          variant="ghost"
          size="sm"
          className="min-h-[44px]"
          onClick={() => {
            try {
              localStorage.setItem(SEEN_KEY, String(Date.now()));
            } catch {}
          }}
        >
          See details
        </ButtonLink>
      </div>
      <div className="absolute top-2 right-2">
        <IconButton icon="x" label="Dismiss" tone="plain" size={36} iconSize={16} onClick={dismiss} />
      </div>
    </Card>
  );
}
