"use client";

// EmptyToday — first-run experience for users who have no active items yet.
// Three clear paths: enroll in a protocol, add an item manually, or scan
// what's in front of them. Replaces the silent "no items" empty state.

import Link from "next/link";
import Icon from "@/components/Icon";

export default function EmptyToday({
  displayName,
}: {
  displayName?: string | null;
}) {
  return (
    <section className="pb-12">
      <div className="text-center max-w-md mx-auto pt-2 mb-8">
        <div
          className="text-[11px] uppercase tracking-wider mb-2"
          style={{
            color: "var(--olive)",
            fontWeight: 600,
            letterSpacing: "0.08em",
          }}
        >
          Day 1
        </div>
        <h2
          className="text-[24px] leading-tight mb-2"
          style={{ fontWeight: 600, letterSpacing: "-0.01em" }}
        >
          {displayName ? `Hey ${displayName} —` : "Welcome —"} let&apos;s build
          your stack.
        </h2>
        <p
          className="text-[13px] leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Pick how you want to start. You can mix and match anytime.
        </p>
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
        color: primary ? "#FBFAF6" : "var(--foreground)",
        boxShadow: primary
          ? "0 8px 24px var(--accent-glow)"
          : undefined,
      }}
    >
      <span
        className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center"
        style={{
          background: primary
            ? "rgba(251, 250, 246, 0.18)"
            : "var(--olive-tint)",
          color: primary ? "#FBFAF6" : "var(--olive)",
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
                  ? "rgba(251, 250, 246, 0.22)"
                  : "var(--olive-tint)",
                color: primary ? "#FBFAF6" : "var(--olive)",
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
            color: primary ? "rgba(251, 250, 246, 0.82)" : "var(--muted)",
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
