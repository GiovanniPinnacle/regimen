"use client";

// At most ONE contextual card between the hero and the checklist.
// Priority:
//   1. Dose safety   — ingredients over the daily upper limit
//   2. Streak        — late in the day, nothing checked off yet (gentle)
//   3. Protocol      — a milestone day (day 1, each week, halfway, last)
//   4. Coach notes   — a single row linking to /coach
//   5. Setup         — reminders not turned on yet
// Everything else Coach has to say lives on /coach.

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { getEnrollments } from "@/lib/storage";
import { listProtocols, formatDuration } from "@/lib/protocols";
import { subscribeToPush } from "@/lib/push";
import { daysBetween, localDateISO } from "@/lib/series";
import { showToast } from "@/lib/toast";

type Card =
  | { kind: "safety"; count: number }
  | { kind: "streak"; streak: number }
  | {
      kind: "protocol";
      slug: string;
      name: string;
      day: number;
      total: number;
    }
  | { kind: "coach"; count: number }
  | { kind: "setup" };

const SETUP_DISMISS_KEY = "regimen.onboarding.dismissed";
const STREAK_DISMISS_KEY = "regimen.streak.dismissed_today.v1";

type Signals = {
  safety: number;
  protocol: Extract<Card, { kind: "protocol" }> | null;
  coachNotes: number;
  setup: boolean;
};

function isMilestone(day: number, total: number) {
  return (
    day === 1 ||
    day === total ||
    day === Math.ceil(total / 2) ||
    (day % 7 === 0 && day < total)
  );
}

async function loadSignals(today: string): Promise<Signals> {
  const c = createClient();
  const [safetyRes, enrollments, insightsRes] = await Promise.all([
    fetch("/api/ingredient-stack", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null) as Promise<{
      warnings?: { severity: string }[];
    } | null>,
    getEnrollments().catch(() => []),
    c
      .from("insights")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
  ]);

  const safety = (safetyRes?.warnings ?? []).filter(
    (w) => w.severity === "critical" || w.severity === "warning",
  ).length;

  let protocol: Signals["protocol"] = null;
  const protocols = listProtocols();
  for (const e of enrollments.filter((x) => x.status === "active")) {
    const p = protocols.find((x) => x.slug === e.protocol_slug);
    if (!p) continue;
    const day = Math.max(0, daysBetween(e.start_date.slice(0, 10), today)) + 1;
    if (isMilestone(Math.min(day, p.duration_days), p.duration_days)) {
      protocol = {
        kind: "protocol",
        slug: p.slug,
        name: p.name,
        day: Math.min(day, p.duration_days),
        total: p.duration_days,
      };
      break;
    }
  }

  let setup = false;
  try {
    setup =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      Notification.permission === "default" &&
      localStorage.getItem(SETUP_DISMISS_KEY) !== "1";
  } catch {}

  return {
    safety,
    protocol,
    coachNotes: insightsRes.error ? 0 : (insightsRes.count ?? 0),
    setup,
  };
}

function Row({
  icon,
  iconTone = "neutral",
  title,
  subtitle,
  href,
  trailing,
  onDismiss,
}: {
  icon: IconName;
  iconTone?: "neutral" | "coach" | "warn";
  title: string;
  subtitle?: string;
  href?: string;
  trailing?: React.ReactNode;
  onDismiss?: () => void;
}) {
  const tile =
    iconTone === "coach"
      ? "bg-[var(--pro-tint)] text-[var(--pro-soft)]"
      : iconTone === "warn"
        ? "bg-[var(--warn-tint)] text-[var(--warn)]"
        : "bg-[var(--surface-alt)] text-[var(--foreground-soft)]";
  const body = (
    <>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${tile}`}
      >
        <Icon name={icon} size={18} strokeWidth={1.8} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-callout font-semibold">
          {title}
        </span>
        {subtitle && (
          <span className="block truncate text-footnote text-[var(--muted)]">
            {subtitle}
          </span>
        )}
      </span>
    </>
  );
  const shell =
    "flex min-h-[60px] items-center gap-3 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5";
  return (
    <section aria-label={title} className="mt-3">
      {href ? (
        <Link
          href={href}
          className={`${shell} active:bg-[var(--surface-alt)] transition-colors`}
        >
          {body}
          <Icon
            name="chevron-right"
            size={16}
            strokeWidth={2}
            className="shrink-0 text-[var(--muted)]"
          />
        </Link>
      ) : (
        <div className={shell}>
          {body}
          {trailing}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--muted)]"
            >
              <Icon name="x" size={16} strokeWidth={2} />
            </button>
          )}
        </div>
      )}
    </section>
  );
}

export default function TodayContextCard({
  streak,
  takenCount,
  totalActive,
}: {
  streak: number | null;
  takenCount: number;
  totalActive: number;
}) {
  const [signals, setSignals] = useState<Signals | null>(null);
  const [today] = useState(() => localDateISO());
  const [hour] = useState(() => new Date().getHours());
  const [dismissed, setDismissed] = useState<{ streak?: boolean; setup?: boolean }>(() => {
    if (typeof window === "undefined") return {};
    try {
      return {
        streak: localStorage.getItem(STREAK_DISMISS_KEY) === localDateISO(),
      };
    } catch {
      return {};
    }
  });
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSignals(today).then((s) => {
      if (alive) setSignals(s);
    });
    return () => {
      alive = false;
    };
  }, [today]);

  if (!signals) return null;

  const streakAtRisk =
    !dismissed.streak &&
    streak != null &&
    streak >= 3 &&
    takenCount === 0 &&
    totalActive > 0 &&
    hour >= 15;

  let card: Card | null = null;
  if (signals.safety > 0) card = { kind: "safety", count: signals.safety };
  else if (streakAtRisk) card = { kind: "streak", streak: streak! };
  else if (signals.protocol) card = signals.protocol;
  else if (signals.coachNotes > 0)
    card = { kind: "coach", count: signals.coachNotes };
  else if (signals.setup && !dismissed.setup) card = { kind: "setup" };
  if (!card) return null;

  switch (card.kind) {
    case "safety":
      return (
        <Row
          icon="alert"
          iconTone="warn"
          title={`${card.count} ingredient${card.count === 1 ? "" : "s"} over the daily limit`}
          subtitle="Across your stack combined. Review doses"
          href="/audit"
        />
      );
    case "streak":
      return (
        <Row
          icon="flame"
          title={`Day ${card.streak + 1} of your streak`}
          subtitle="Any one item today keeps it going"
          onDismiss={() => {
            try {
              localStorage.setItem(STREAK_DISMISS_KEY, today);
            } catch {}
            setDismissed((d) => ({ ...d, streak: true }));
          }}
        />
      );
    case "protocol": {
      const left = card.total - card.day;
      return (
        <Row
          icon="calendar"
          title={`${card.name}: day ${card.day} of ${card.total}`}
          subtitle={
            left > 0
              ? `${formatDuration(left)} to go`
              : "Last day. Nice work"
          }
          href={`/protocols/${card.slug}`}
        />
      );
    }
    case "coach":
      return (
        <Row
          icon="sparkle"
          iconTone="coach"
          title={`Coach has ${card.count} note${card.count === 1 ? "" : "s"} for you`}
          subtitle="Patterns spotted in your data"
          href="/coach"
        />
      );
    case "setup":
      return (
        <Row
          icon="bell"
          title="Get a nudge when it's time"
          subtitle="Reminders for each part of your day"
          trailing={
            <Button
              size="md"
              variant="secondary"
              className="px-3 text-callout"
              loading={enabling}
              onClick={async () => {
                setEnabling(true);
                const res = await subscribeToPush();
                setEnabling(false);
                if (res.ok) {
                  showToast("Reminders on", { tone: "success" });
                  setDismissed((d) => ({ ...d, setup: true }));
                } else {
                  showToast(res.error, { tone: "error" });
                }
              }}
            >
              Turn on
            </Button>
          }
          onDismiss={() => {
            try {
              localStorage.setItem(SETUP_DISMISS_KEY, "1");
            } catch {}
            setDismissed((d) => ({ ...d, setup: true }));
          }}
        />
      );
  }
}
