"use client";

// /protocols — browse + manage. Enrolled protocols get hero treatment;
// the rest live in a Discover grid.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  listProtocols,
  formatDuration,
  isProtocolEnrollable,
  PROTOCOL_CATEGORY_LABELS,
} from "@/lib/protocols";
import { getEnrollments } from "@/lib/storage";
import type { Protocol, ProtocolCategory } from "@/lib/types";
import Icon from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import { SkeletonLine, SkeletonCard } from "@/components/Skeleton";

const CATEGORIES: ("all" | ProtocolCategory)[] = [
  "all",
  "recovery",
  "fitness",
  "posture",
  "sleep",
  "metabolic",
];

type EnrollmentSummary = {
  protocol_slug: string;
  start_date: string;
  status: string;
};

export default function ProtocolsBrowsePage() {
  const protocols = useMemo(() => listProtocols(), []);
  const [enrollments, setEnrollments] = useState<EnrollmentSummary[] | null>(
    null,
  );
  const [filter, setFilter] = useState<"all" | ProtocolCategory>("all");

  useEffect(() => {
    (async () => {
      try {
        const list = await getEnrollments();
        setEnrollments(list);
      } catch {
        setEnrollments([]);
      }
    })();
  }, []);

  const enrolledMap = useMemo(() => {
    return new Map(
      (enrollments ?? [])
        .filter((e) => e.status === "active")
        .map((e) => [e.protocol_slug, e]),
    );
  }, [enrollments]);

  const enrolledProtocols = protocols.filter((p) => enrolledMap.has(p.slug));

  const discoverProtocols = protocols
    .filter((p) => !enrolledMap.has(p.slug))
    .filter((p) => filter === "all" || p.category === filter);

  return (
    <div className="pb-24">
      <header className="mb-7">
        <h1
          className="text-[32px] leading-tight"
          style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          Protocols
        </h1>
        <p
          className="text-[14px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Prebuilt regimens, refined to you. Enroll once and items
          auto-populate Today as their day arrives.
        </p>
      </header>

      {/* Enrolled — hero treatment */}
      {enrollments === null ? (
        <section className="mb-7">
          <SectionHeader title="Your protocols" />
          <SkeletonCard height={140} />
        </section>
      ) : enrolledProtocols.length > 0 ? (
        <section className="mb-7">
          <SectionHeader
            title="Your protocols"
            subtitle={`${enrolledProtocols.length} active`}
          />
          <div className="flex flex-col gap-3">
            {enrolledProtocols.map((p) => (
              <HeroEnrolledCard
                key={p.slug}
                protocol={p}
                startDate={enrolledMap.get(p.slug)!.start_date}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Filter chips */}
      <section className="mb-3">
        <SectionHeader
          title={enrolledProtocols.length > 0 ? "Discover more" : "Discover"}
        />
        <div className="-mx-4">
          <div
            className="flex gap-2 px-4 overflow-x-auto pb-1"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {CATEGORIES.map((c) => {
              const active = filter === c;
              return (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  className="shrink-0 text-[12px] px-3.5 py-2 rounded-full transition-all"
                  style={{
                    background: active ? "var(--olive)" : "var(--surface)",
                    color: active ? "#FBFAF6" : "var(--foreground)",
                    border: active
                      ? "1px solid var(--olive)"
                      : "1px solid var(--border)",
                    fontWeight: active ? 600 : 500,
                    minHeight: "32px",
                  }}
                >
                  {c === "all" ? "All" : PROTOCOL_CATEGORY_LABELS[c] ?? c}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Discover grid */}
      {enrollments === null ? (
        <div className="flex flex-col gap-2">
          <SkeletonCard height={88} />
          <SkeletonCard height={88} />
          <SkeletonCard height={88} />
        </div>
      ) : discoverProtocols.length > 0 ? (
        <div className="flex flex-col gap-2">
          {discoverProtocols.map((p) => (
            <DiscoverCard key={p.slug} protocol={p} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="🔎"
          title="Nothing matching."
          body="Try a different category or check back soon — new protocols ship regularly."
        />
      )}

      {/* How it works — small, low key */}
      <section
        className="mt-8 rounded-2xl p-5"
        style={{
          background: "var(--olive-tint)",
          border: "1px solid var(--accent-glow)",
        }}
      >
        <SectionHeader title="How protocols work" />
        <ul
          className="text-[13px] flex flex-col gap-1.5 leading-relaxed"
          style={{ color: "var(--foreground)", opacity: 0.85 }}
        >
          <li>
            <strong>Day-gated.</strong> Items appear on /today when their day
            opens (e.g., minoxidil unlocks Day 14, microneedling Day 30).
          </li>
          <li>
            <strong>Research-backed.</strong> Each item cites why and when it
            should help. No vibes.
          </li>
          <li>
            <strong>Refinement-first.</strong> Coach reads your skips +
            reactions and recommends drops as you go.
          </li>
          <li>
            <strong>Stackable.</strong> Enroll in multiple. They merge cleanly
            on /today.
          </li>
        </ul>
      </section>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h2
        className="text-[11px] uppercase tracking-wider"
        style={{
          color: "var(--muted)",
          fontWeight: 600,
          letterSpacing: "0.06em",
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <span
          className="text-[11px]"
          style={{ color: "var(--muted)" }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
}

function HeroEnrolledCard({
  protocol,
  startDate,
}: {
  protocol: Protocol;
  startDate: string;
}) {
  const start = new Date(startDate);
  const dayN = Math.max(
    0,
    Math.floor((Date.now() - start.getTime()) / 86400000),
  ) + 1;
  const totalDays = protocol.duration_days;
  const progress = Math.min(100, Math.round((dayN / totalDays) * 100));

  return (
    <Link
      href={`/protocols/${protocol.slug}`}
      className="block rounded-3xl p-5 pressable relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, var(--olive) 0%, var(--olive-deep) 100%)",
        color: "#FBFAF6",
        boxShadow: "0 12px 36px var(--accent-glow)",
      }}
    >
      <div className="flex items-start gap-3 mb-4 relative">
        <div
          className="text-[36px] leading-none shrink-0"
          aria-hidden
          style={{
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))",
          }}
        >
          {protocol.cover_emoji ?? "📋"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(251, 250, 246, 0.18)",
                color: "#FBFAF6",
                fontWeight: 600,
                letterSpacing: "0.06em",
              }}
            >
              Active · Day {dayN} / {totalDays}
            </span>
          </div>
          <div
            className="text-[19px] leading-tight"
            style={{ fontWeight: 600, letterSpacing: "-0.01em" }}
          >
            {protocol.name}
          </div>
          <div
            className="text-[13px] mt-1 leading-snug"
            style={{ opacity: 0.82 }}
          >
            {protocol.tagline}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "rgba(251, 250, 246, 0.18)" }}
        aria-label={`${progress}% complete`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${progress}%`,
            background: "rgba(251, 250, 246, 0.85)",
          }}
        />
      </div>
      <div
        className="text-[11px] mt-2 flex items-center justify-between"
        style={{ opacity: 0.78 }}
      >
        <span>
          {totalDays - dayN > 0
            ? `${totalDays - dayN} days remaining`
            : "Protocol complete"}
        </span>
        <span className="flex items-center gap-1">
          View
          <Icon name="chevron-right" size={12} strokeWidth={2} />
        </span>
      </div>
    </Link>
  );
}

function DiscoverCard({ protocol }: { protocol: Protocol }) {
  const enrollable = isProtocolEnrollable(protocol);
  // Non-enrollable protocols can't be tapped through to a dead detail
  // page. Render as a plain div with reduced opacity instead.
  const Wrapper = enrollable
    ? ({ children }: { children: React.ReactNode }) => (
        <Link
          href={`/protocols/${protocol.slug}`}
          className="rounded-2xl card-glass p-3.5 flex gap-3 items-start pressable"
        >
          {children}
        </Link>
      )
    : ({ children }: { children: React.ReactNode }) => (
        <div
          className="rounded-2xl card-glass p-3.5 flex gap-3 items-start"
          style={{ opacity: 0.7 }}
          aria-disabled
        >
          {children}
        </div>
      );
  return (
    <Wrapper>
      <div
        className="text-[26px] leading-none shrink-0 h-12 w-12 rounded-xl flex items-center justify-center"
        style={{
          background: enrollable ? "var(--olive-tint)" : "var(--surface-alt)",
        }}
        aria-hidden
      >
        {protocol.cover_emoji ?? "📋"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span
            className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
            style={{
              background: "var(--olive-tint)",
              color: "var(--olive)",
              fontWeight: 600,
              letterSpacing: "0.06em",
            }}
          >
            {PROTOCOL_CATEGORY_LABELS[protocol.category] ?? protocol.category}
          </span>
          <span
            className="text-[11px]"
            style={{ color: "var(--muted)" }}
          >
            {formatDuration(protocol.duration_days)}
          </span>
          {protocol.pricing_cents > 0 && (
            <span
              className="text-[11px] px-1.5 py-0.5 rounded-full"
              style={{
                background: "var(--pro-tint)",
                color: "var(--purple)",
                fontWeight: 600,
              }}
            >
              ${(protocol.pricing_cents / 100).toFixed(0)}
            </span>
          )}
        </div>
        <div
          className="text-[15px] leading-snug"
          style={{ fontWeight: 500 }}
        >
          {protocol.name}
        </div>
        <div
          className="text-[12px] mt-0.5 leading-snug line-clamp-2"
          style={{ color: "var(--muted)" }}
        >
          {protocol.tagline}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          {enrollable ? (
            <span
              className="text-[11px] flex items-center gap-1"
              style={{ color: "var(--olive)", fontWeight: 600 }}
            >
              {protocol.items.length} items
              <Icon name="chevron-right" size={11} strokeWidth={2} />
            </span>
          ) : (
            <span
              className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                background: "var(--surface-alt)",
                color: "var(--muted)",
                fontWeight: 600,
                letterSpacing: "0.06em",
              }}
            >
              Coming soon
            </span>
          )}
        </div>
      </div>
    </Wrapper>
  );
}
