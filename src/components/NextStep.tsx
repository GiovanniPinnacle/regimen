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
import Link from "next/link";
import Icon from "@/components/Icon";
import type { UserStage, UserSignals } from "@/lib/context";

type IconName = Parameters<typeof Icon>[0]["name"];

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

  if (loading || !state) return null;

  const step = pickStep(state, todayTakenCount);
  if (!step) return null;

  function fireCoach(prompt: string) {
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: prompt, send: true },
      }),
    );
  }

  return (
    <section
      className="rounded-2xl mb-6 overflow-hidden relative"
      style={{
        background: `linear-gradient(135deg, ${step.accent} 0%, color-mix(in oklab, ${step.accent} 70%, black) 100%)`,
        color: "#FBFAF6",
        boxShadow: `0 12px 32px color-mix(in oklab, ${step.accent} 35%, transparent)`,
      }}
    >
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <span
            className="shrink-0 mt-0.5 h-9 w-9 rounded-xl flex items-center justify-center"
            style={{
              background: "rgba(251, 250, 246, 0.20)",
              color: "#FBFAF6",
            }}
          >
            <Icon name={step.icon} size={18} strokeWidth={1.8} />
          </span>
          <div className="flex-1 min-w-0">
            <div
              className="text-[10px] uppercase tracking-wider"
              style={{
                opacity: 0.85,
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              {step.label}
            </div>
            <div
              className="text-[16px] leading-snug mt-0.5"
              style={{ fontWeight: 700 }}
            >
              {step.title}
            </div>
            <div
              className="text-[12.5px] mt-1 leading-relaxed"
              style={{ opacity: 0.88 }}
            >
              {step.body}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-3 ml-12">
          {step.primary.type === "link" && step.primary.href ? (
            <Link
              href={step.primary.href}
              className="text-[13px] px-3.5 py-2 rounded-lg flex items-center gap-1.5"
              style={{
                background: "rgba(251, 250, 246, 0.96)",
                color: `color-mix(in oklab, ${step.accent} 80%, black)`,
                fontWeight: 700,
              }}
            >
              <Icon name="check-circle" size={13} strokeWidth={2.2} />
              {step.primary.label}
            </Link>
          ) : (
            <button
              onClick={() =>
                step.primary.coachPrompt && fireCoach(step.primary.coachPrompt)
              }
              className="text-[13px] px-3.5 py-2 rounded-lg flex items-center gap-1.5"
              style={{
                background: "rgba(251, 250, 246, 0.96)",
                color: `color-mix(in oklab, ${step.accent} 80%, black)`,
                fontWeight: 700,
              }}
            >
              <Icon name="sparkle" size={13} strokeWidth={2.2} />
              {step.primary.label}
            </button>
          )}
          {step.secondary &&
            (step.secondary.type === "link" && step.secondary.href ? (
              <Link
                href={step.secondary.href}
                className="text-[13px] px-3 py-2 rounded-lg"
                style={{
                  background: "rgba(251, 250, 246, 0.18)",
                  color: "#FBFAF6",
                  fontWeight: 600,
                }}
              >
                {step.secondary.label}
              </Link>
            ) : (
              <button
                onClick={() =>
                  step.secondary?.coachPrompt &&
                  fireCoach(step.secondary.coachPrompt)
                }
                className="text-[13px] px-3 py-2 rounded-lg"
                style={{
                  background: "rgba(251, 250, 246, 0.18)",
                  color: "#FBFAF6",
                  fontWeight: 600,
                }}
              >
                {step.secondary.label}
              </button>
            ))}
        </div>
      </div>
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
      accent: "var(--premium)",
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
      accent: "var(--accent)",
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
      accent: "var(--accent)",
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
      accent: "var(--accent)",
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
