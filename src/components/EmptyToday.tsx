"use client";

// EmptyToday — first-run experience for users who have no active items yet.
// New v2 (May 2026): leads with the inline starter pack (tap-to-add
// evidence-A items) so the user gets to a non-empty stack in 30
// seconds without leaving the page. Three "deeper paths" stay below
// for users who want more structure (protocol enroll, manual add,
// scan a label).

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import EmptyGlyph from "@/components/EmptyGlyph";
import StarterPack from "@/components/StarterPack";
import { createClient } from "@/lib/supabase/client";

export default function EmptyToday({
  displayName,
}: {
  displayName?: string | null;
}) {
  // Pull the user's onboarding focus (if they completed /onboard) so
  // we can bias the starter-pack toward what they care about. Falls
  // back to "general" if no focus is set yet.
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const client = createClient();
        const { data } = await client
          .from("profiles")
          .select("about_me")
          .maybeSingle();
        if (!alive) return;
        const aboutMe = (data?.about_me ?? {}) as Record<string, string>;
        const goals = aboutMe.top_goals ?? "";
        const m = goals.match(/Focus:\s*(\w+)/);
        if (m) setFocus(m[1]);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="pb-12">
      <div className="text-center max-w-md mx-auto pt-2 mb-6">
        {/* Hero glyph — visual anchor before the user has any data of
            their own. Tinted accent block + sparkle icon reads as
            "this is the start of something" instead of "empty list." */}
        <div className="flex justify-center mb-4">
          <EmptyGlyph icon="sparkle" tone="accent" size={68} />
        </div>
        <div
          className="text-[11px] uppercase tracking-wider mb-2"
          style={{
            color: "var(--accent)",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          Day 1
        </div>
        <h2
          className="text-[26px] leading-tight mb-2"
          style={{ fontWeight: 700, letterSpacing: "-0.018em" }}
        >
          {displayName ? `Hey ${displayName} —` : "Welcome —"} let&apos;s build
          your stack.
        </h2>
        <p
          className="text-[13.5px] leading-relaxed"
          style={{ color: "var(--foreground-soft)" }}
        >
          Tap the items below you take or want to try. Coach refines from there.
        </p>
      </div>

      {/* Inline tap-to-add picker — the fastest path from empty to a
          working stack. After at least one add, /today re-renders with
          actual items and EmptyToday goes away. */}
      <div className="max-w-md mx-auto">
        <StarterPack focus={focus} count={10} />
      </div>

      <div className="text-center mb-3 mt-1">
        <span
          className="text-[11px] uppercase tracking-wider"
          style={{
            color: "var(--muted)",
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}
        >
          Or take a deeper path
        </span>
      </div>

      <div className="flex flex-col gap-2 max-w-md mx-auto mb-8">
        <PathCard
          href="/protocols"
          icon="award"
          title="Enroll in a protocol"
          subtitle="Curated regimens — recovery, sleep, fitness. Items auto-populate Today."
          badge="Recommended"
          primary
        />
        <PathCard
          href="/items/new"
          icon="plus"
          title="Add a single item"
          subtitle="Type a name, Coach classifies the rest. Magnesium, minoxidil, anything."
        />
        <PathCard
          href="/scan"
          icon="camera"
          title="Scan a label"
          subtitle="Photograph your supplement bottle and Coach extracts dose + ingredients."
        />
      </div>

      <div className="max-w-md mx-auto">
        <div
          className="text-[11px] uppercase tracking-wider mb-3"
          style={{
            color: "var(--muted)",
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}
        >
          What you&apos;ll have on Today
        </div>
        <div
          className="rounded-2xl p-4"
          style={{
            background: "var(--olive-tint)",
            border: "1px solid var(--accent-glow)",
          }}
        >
          <ul
            className="text-[12px] flex flex-col gap-1.5 leading-relaxed"
            style={{ color: "var(--foreground)", opacity: 0.9 }}
          >
            <li>
              · <strong>Time-of-day strip</strong> — what to take when, with
              progress
            </li>
            <li>
              · <strong>Intake tracker</strong> — water + meal photos +
              auto-logged macros
            </li>
            <li>
              · <strong>Voice memos</strong> — vent, log, note. Coach reads
              them.
            </li>
            <li>
              · <strong>Patterns card</strong> — once you have 7+ days, drop
              candidates surface automatically
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function PathCard({
  href,
  icon,
  title,
  subtitle,
  badge,
  primary = false,
}: {
  href: string;
  icon: Parameters<typeof Icon>[0]["name"];
  title: string;
  subtitle: string;
  badge?: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl p-4 pressable flex items-start gap-3"
      style={{
        background: primary ? "var(--olive)" : "var(--surface)",
        border: primary
          ? "1px solid var(--olive)"
          : "1px solid var(--border)",
        color: primary ? "#FFFFFF" : "var(--foreground)",
        boxShadow: primary
          ? "0 8px 24px var(--accent-glow)"
          : undefined,
      }}
    >
      <span
        className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center"
        style={{
          background: primary
            ? "rgba(255, 255, 255, 0.18)"
            : "var(--olive-tint)",
          color: primary ? "#FFFFFF" : "var(--olive)",
        }}
      >
        <Icon name={icon} size={20} strokeWidth={1.7} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="text-[15px] leading-snug"
            style={{ fontWeight: 600 }}
          >
            {title}
          </div>
          {badge && (
            <span
              className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
              style={{
                background: primary
                  ? "rgba(255, 255, 255, 0.22)"
                  : "var(--olive-tint)",
                color: primary ? "#FFFFFF" : "var(--olive)",
                fontWeight: 600,
                letterSpacing: "0.06em",
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <div
          className="text-[12px] mt-0.5 leading-relaxed"
          style={{
            color: primary ? "rgba(255, 255, 255, 0.82)" : "var(--muted)",
          }}
        >
          {subtitle}
        </div>
      </div>
      <Icon
        name="chevron-right"
        size={16}
        className="shrink-0 mt-1.5 opacity-70"
      />
    </Link>
  );
}
