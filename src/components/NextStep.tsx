"use client";

// NextStep — the single most important "do this now" card on /today.
//
// The app already surfaces lots of action signals (StreakAtRiskBanner,
// MagicMomentPrompt, InsightsBanner, PatternCard, CoachQuickActions). But
// without a primary the user is overwhelmed: what do I do FIRST? NextStep
// reads the user's current state via /api/user-state and renders ONE bold
// CTA based on a strict priority order. Subordinate components still
// render below for breadth.
//
// Priority order (top → bottom; first match wins):
//   1. Protocol completed but not acknowledged       → celebrate
//   2. Items arrived, not marked using               → "Mark using"
//   3. Brand new (0 active items)                    → "Build your stack"
//   4. Items added but never logged today            → "Check off your first item"
//   5. Magic-moment ready (3-6 days, no refinement)  → "Run your first refinement"
//   6. Items needing order ($X)                      → "Order N items"
//   7. Pending stack audit (5+ items)                → "Audit your stack"
//   8. Worsened items (2+ "worse" reactions)         → "Review what's worsening"
//   9. Active protocol mid-progress                  → "Day X of Y — keep going"
//  10. Long-term user, no obvious signal             → null (let other components shine)

import { useEffect, useState } from "react";
import { type IconName } from "@/components/Icon";
import Button, { ButtonLink } from "@/components/ui/Button";
import { usePulseCount } from "@/components/CoachPulse";
import { CoachNoteCard, type NoteTone } from "@/components/CoachCardStack";
import { openCoach } from "@/lib/coach-events";
import type { UserStage, UserSignals } from "@/lib/context";

type StateRes = {
  stage: UserStage;
  signals: UserSignals;
  activeCount: number;
  displayName: string | null;
  /** Reaction signal density — drives data-confidence checks before
   *  pushing premature refinement. */
  reactionCount30d?: number;
};

type Step = {
  kind: string;
  label: string; // small uppercase tag
  title: string;
  body: string;
  icon: IconName;
  accent: string; // CSS variable
  primary: {
    label: string;
    type: "link" | "coach";
    href?: string;
    coachPrompt?: string;
  };
  secondary?: {
    label: string;
    href?: string;
    type: "link" | "coach";
    coachPrompt?: string;
  };
};

export default function NextStep({
  todayTakenCount,
}: {
  todayTakenCount: number;
}) {
  const [state, setState] = useState<StateRes | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/user-state");
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = (await res.json()) as StateRes;
        if (!alive) return;
        setState(data);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const step = !loading && state ? pickStep(state, todayTakenCount) : null;
  usePulseCount("next_step", step ? 1 : 0);

  if (loading || !state) return null;
  if (!step) return null;

  const tone: NoteTone =
    step.accent === "var(--premium)"
      ? "premium"
      : step.accent === "var(--pro)"
        ? "coach"
        : step.accent === "var(--error)"
          ? "danger"
          : step.accent === "var(--success)"
            ? "success"
            : "neutral";

  const renderAction = (
    a: Step["primary"] | NonNullable<Step["secondary"]>,
    primary: boolean,
  ) =>
    a.type === "link" && a.href ? (
      <ButtonLink
        href={a.href}
        size="md"
        variant={primary ? "primary" : "secondary"}
      >
        {a.label}
      </ButtonLink>
    ) : (
      <Button
        size="md"
        variant={primary ? "coach" : "secondary"}
        icon={primary ? "sparkle" : undefined}
        onClick={() => a.coachPrompt && openCoach({ text: a.coachPrompt, send: true })}
      >
        {a.label}
      </Button>
    );

  return (
    <section className="mb-6">
      <CoachNoteCard
        icon={step.icon}
        tone={tone}
        eyebrow={step.label}
        title={step.title}
        body={step.body}
        actions={
          <>
            {renderAction(step.primary, true)}
            {step.secondary && renderAction(step.secondary, false)}
          </>
        }
      />
    </section>
  );
}

// Pick the single most-important next step based on stage + signals.
function pickStep(s: StateRes, todayTakenCount: number): Step | null {
  const sig = s.signals;

  // 1. Protocol completed
  const completedProtocol = sig.activeProtocols.find((p) => p.completed);
  if (completedProtocol) {
    return {
      kind: "protocol_complete",
      label: "Milestone",
      title: `You finished ${humanizeSlug(completedProtocol.slug)}`,
      body: `Day ${completedProtocol.current_day} of ${completedProtocol.duration_days}. Lock in what worked, drop what didn't.`,
      icon: "award",
      // Finishing a protocol is a genuine success moment.
      accent: "var(--success)",
      primary: {
        label: "Apply learnings",
        type: "coach",
        coachPrompt: `I just completed the protocol "${completedProtocol.slug}" (Day ${completedProtocol.current_day} of ${completedProtocol.duration_days}). Look at my last ${completedProtocol.duration_days} days of skips, reactions, and voice memos. Decide which protocol items I should KEEP (move to permanent), DROP (retire), or CYCLE. Emit each decision as a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format.`,
      },
      secondary: {
        label: "Browse next",
        type: "link",
        href: "/protocols",
      },
    };
  }

  // 2. Arrived items not marked using
  if (sig.arrivedUnmarkedCount > 0) {
    return {
      kind: "arrived",
      label: "Just arrived",
      title: `${sig.arrivedUnmarkedCount} ${sig.arrivedUnmarkedCount === 1 ? "item" : "items"} ready to start`,
      body: `Mark them as "using" to add them to your daily check-off.`,
      icon: "shopping-bag",
      accent: "var(--foreground)",
      primary: {
        label: "Mark using",
        type: "link",
        href: "/purchases",
      },
    };
  }

  // 3. Brand new — 0 active items
  if (s.stage === "first_visit") {
    return {
      kind: "first_visit",
      label: "Welcome",
      title: "Build your starter stack",
      body: "Add 3-5 items you take regularly. Coach takes it from there — refining as you log.",
      icon: "plus",
      accent: "var(--pro)",
      primary: {
        label: "Add first item",
        type: "link",
        href: "/items/new",
      },
      secondary: {
        label: "Browse protocols",
        type: "link",
        href: "/protocols",
      },
    };
  }

  // 4. Stack built but nothing logged today
  if (s.stage === "stack_built" || (s.stage === "early_logging" && todayTakenCount === 0)) {
    return {
      kind: "log_today",
      label: "Today",
      title:
        todayTakenCount === 0
          ? "Tap one item to start your streak"
          : "Keep your streak alive",
      body:
        s.stage === "stack_built"
          ? `You have ${s.activeCount} items waiting. The first check-off is the hardest — start with anything.`
          : `${sig.uniqueLogDays14d} of last 14 days logged. One tap keeps the streak.`,
      icon: "check-circle",
      accent: "var(--foreground)",
      primary: {
        label: "Scroll to today",
        type: "link",
        href: "#today-checklist",
      },
    };
  }

  // 5. Magic-moment ready — but check data confidence first
  if (s.stage === "magic_ready") {
    const reactions = s.reactionCount30d ?? 0;
    // Need at least 5 reactions across the stack to make a confident
    // refinement call. Otherwise prompt for MORE data before forcing it.
    if (reactions < 5) {
      return {
        kind: "needs_more_data",
        label: "Almost there",
        title: "Coach needs more signal first",
        body: `${sig.uniqueLogDays14d} days logged, but only ${reactions} reaction${reactions === 1 ? "" : "s"} so far. Tap helped/no-change/worse on a few items to teach Coach what's working.`,
        icon: "graph",
        accent: "var(--pro)",
        primary: {
          label: "Go react to today",
          type: "link",
          href: "#today-checklist",
        },
        secondary: {
          label: "Why does this matter?",
          type: "coach",
          coachPrompt:
            "Why do you need at least 5 reactions before recommending a refinement? Explain in 2 sentences using my actual situation.",
        },
      };
    }
    return {
      kind: "magic_ready",
      label: "Ready",
      title: "Run your first refinement",
      body: `${sig.uniqueLogDays14d} days of data + ${reactions} reactions. Coach can read your patterns now and tell you what to drop.`,
      icon: "sparkle",
      accent: "var(--pro)",
      primary: {
        label: "Run refinement",
        type: "coach",
        coachPrompt: `I have ${sig.uniqueLogDays14d} days of stack_log data and ${reactions} reactions. Run a quick refinement: audit my last 14 days of skips and reactions, find the single most-likely drop candidate, and propose the change in <<<PROPOSAL ... PROPOSAL>>> format so I can approve it in one tap. If you don't have enough confidence to make a call, say so honestly and tell me what data you'd need.`,
      },
      secondary: { label: "See full reveal", type: "link", href: "/welcome" },
    };
  }

  // 6. Worsened items — high priority because urgent
  if (sig.worsenedItemCount > 0) {
    return {
      kind: "worsened",
      label: "Review urgent",
      title: `${sig.worsenedItemCount} ${sig.worsenedItemCount === 1 ? "item is" : "items are"} getting worse`,
      body: `2+ "worse" reactions in the last 30 days. Pause or drop before symptoms compound.`,
      icon: "alert",
      accent: "var(--error)",
      primary: {
        label: "Coach decides",
        type: "coach",
        coachPrompt: `${sig.worsenedItemCount} items in my stack have 2+ "worse" reactions in the last 30 days. For each, decide: pause, drop, or troubleshoot. Emit each decision as a one-tap <<<PROPOSAL ... PROPOSAL>>> with action: retire (drop) or adjust (pause via notes).`,
      },
      secondary: { label: "See patterns", type: "link", href: "/insights" },
    };
  }

  // 7. Items needing order
  if (sig.pendingOrderCount > 0) {
    return {
      kind: "needs_order",
      label: "Shopping",
      title: `Order ${sig.pendingOrderCount} ${sig.pendingOrderCount === 1 ? "item" : "items"}`,
      body: `You marked these "need" in your last audit. Tap to see costs and links.`,
      icon: "shopping-bag",
      accent: "var(--premium)",
      primary: {
        label: "Open shopping list",
        type: "link",
        href: "/purchases",
      },
    };
  }

  // 8. Pending audit
  if (sig.pendingAuditCount >= 5) {
    return {
      kind: "needs_audit",
      label: "Audit",
      title: `${sig.pendingAuditCount} items waiting on triage`,
      body: `Tap once per item — Have / Need / Skip. Done in under 2 minutes.`,
      icon: "check-circle",
      accent: "var(--pro)",
      primary: {
        label: "Run audit",
        type: "link",
        href: "/audit",
      },
    };
  }

  // 9. Mid-protocol
  const ongoing = sig.activeProtocols.find(
    (p) => !p.completed && p.current_day < p.duration_days,
  );
  if (ongoing) {
    return {
      kind: "protocol_progress",
      label: "Protocol",
      title: `${humanizeSlug(ongoing.slug)} · Day ${ongoing.current_day} of ${ongoing.duration_days}`,
      body: `${Math.round((ongoing.current_day / ongoing.duration_days) * 100)}% complete. Stay consistent through the next phase.`,
      icon: "graph",
      accent: "var(--foreground)",
      primary: {
        label: "View today",
        type: "link",
        href: `/protocols/${ongoing.slug}`,
      },
      secondary: {
        label: "Adjust",
        type: "coach",
        coachPrompt: `I'm Day ${ongoing.current_day} of ${ongoing.duration_days} on the "${ongoing.slug}" protocol. Anything I should adjust based on my last 7 days of data?`,
      },
    };
  }

  // No clear next step — let other components surface signals
  return null;
}

function humanizeSlug(s: string): string {
  return s
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
