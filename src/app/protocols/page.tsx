"use client";

// /protocols — browse + manage. Enrolled protocols show progress up top;
// the rest live in a Discover list.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  listProtocols,
  formatDuration,
  isProtocolEnrollable,
  protocolIcon,
  PROTOCOL_CATEGORY_LABELS,
} from "@/lib/protocols";
import { getEnrollments } from "@/lib/storage";
import type { Protocol, ProtocolCategory } from "@/lib/types";
import Icon from "@/components/Icon";
import EmptyState from "@/components/EmptyState";
import { SkeletonCard } from "@/components/Skeleton";
import PageHeader from "@/components/ui/PageHeader";
import Card, { cardClass } from "@/components/ui/Card";
import Chip, { ChipButton } from "@/components/ui/Chip";
import { SectionHeader } from "@/components/ui/Section";

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
  const [now] = useState(() => Date.now());

  useEffect(() => {
    getEnrollments()
      .then(setEnrollments)
      .catch(() => setEnrollments([]));
  }, []);

  const enrolledMap = useMemo(
    () =>
      new Map(
        (enrollments ?? [])
          .filter((e) => e.status === "active")
          .map((e) => [e.protocol_slug, e]),
      ),
    [enrollments],
  );

  // Only offer filters for categories that actually have protocols.
  const categories = useMemo(() => {
    const seen = new Set<ProtocolCategory>();
    protocols.forEach((p) => seen.add(p.category));
    return ["all", ...seen] as ("all" | ProtocolCategory)[];
  }, [protocols]);

  const enrolledProtocols = protocols.filter((p) => enrolledMap.has(p.slug));
  const discoverProtocols = protocols
    .filter((p) => !enrolledMap.has(p.slug))
    .filter((p) => filter === "all" || p.category === filter)
    // Enrollable first, "coming soon" last.
    .sort(
      (a, b) =>
        Number(isProtocolEnrollable(b)) - Number(isProtocolEnrollable(a)),
    );

  return (
    <div className="pb-24">
      <PageHeader
        title="Protocols"
        subtitle="Day-by-day plans. Start one and its items appear on Today as each day arrives."
      />

      {enrollments === null ? (
        <section className="mb-2">
          <SkeletonCard height={120} />
        </section>
      ) : enrolledProtocols.length > 0 ? (
        <section>
          <SectionHeader title="Following" className="!mt-0" />
          <div className="flex flex-col gap-3">
            {enrolledProtocols.map((p) => (
              <EnrolledCard
                key={p.slug}
                protocol={p}
                startDate={enrolledMap.get(p.slug)!.start_date}
                now={now}
              />
            ))}
          </div>
        </section>
      ) : null}

      <SectionHeader
        title={enrolledProtocols.length > 0 ? "Discover more" : "Discover"}
        className={enrolledProtocols.length > 0 ? "" : "!mt-0"}
      />
      <div className="-mx-5 mb-4 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2 py-1.5">
          {categories.map((c) => (
            <ChipButton
              key={c}
              selected={filter === c}
              onClick={() => setFilter(c)}
              className="shrink-0"
            >
              {c === "all" ? "All" : (PROTOCOL_CATEGORY_LABELS[c] ?? c)}
            </ChipButton>
          ))}
        </div>
      </div>

      {enrollments === null ? (
        <div className="flex flex-col gap-2">
          <SkeletonCard height={96} />
          <SkeletonCard height={96} />
        </div>
      ) : discoverProtocols.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {discoverProtocols.map((p) => (
            <DiscoverCard key={p.slug} protocol={p} />
          ))}
        </div>
      ) : (
        <EmptyState
          glyph="search"
          title="Nothing here yet"
          body="Try another category. New protocols are on the way."
        />
      )}

      <SectionHeader title="How protocols work" />
      <Card padding="md">
        <ul className="flex flex-col gap-3">
          {[
            ["calendar", "Day by day", "Items show up on Today when their day arrives."],
            ["book", "Explained", "Each item says why it's there and when it should help."],
            ["trend-down", "Trimmed as you go", "Coach reads your skips and suggests what to drop."],
            ["list-ordered", "Stackable", "Follow more than one; they merge on Today."],
          ].map(([icon, title, body]) => (
            <li key={title} className="flex items-start gap-3">
              <Icon
                name={icon as Parameters<typeof Icon>[0]["name"]}
                size={18}
                strokeWidth={1.8}
                className="mt-0.5 shrink-0 text-[var(--muted)]"
              />
              <div>
                <div className="text-callout font-semibold">{title}</div>
                <div className="text-footnote text-[var(--muted)]">{body}</div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function CoverTile({ protocol, size = 44 }: { protocol: Protocol; size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-[12px] border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--foreground-soft)]"
      style={{ width: size, height: size }}
    >
      <Icon name={protocolIcon(protocol)} size={Math.round(size * 0.46)} strokeWidth={1.8} />
    </span>
  );
}

function EnrolledCard({
  protocol,
  startDate,
  now,
}: {
  protocol: Protocol;
  startDate: string;
  now: number;
}) {
  const dayN =
    Math.max(0, Math.floor((now - new Date(startDate).getTime()) / 86400000)) + 1;
  const total = protocol.duration_days;
  const progress = Math.min(100, Math.round((dayN / total) * 100));
  const left = total - dayN;

  return (
    <Link
      href={`/protocols/${protocol.slug}`}
      className={cardClass({ variant: "raised", padding: "lg", interactive: true, className: "block" })}
    >
      <div className="flex items-start gap-3">
        <CoverTile protocol={protocol} />
        <div className="min-w-0 flex-1">
          <div className="text-body font-semibold">{protocol.name}</div>
          <div className="mt-0.5 text-footnote text-[var(--muted)]">
            Day {Math.min(dayN, total)} of {total}
          </div>
        </div>
        <Icon name="chevron-right" size={18} strokeWidth={2} className="mt-1 shrink-0 text-[var(--muted)]" />
      </div>
      <div
        className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--border)]"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${protocol.name} progress`}
      >
        <div
          className={`h-full rounded-full ${left > 0 ? "bg-[var(--foreground)]" : "bg-[var(--success)]"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-2 text-caption text-[var(--muted)]">
        {left > 0 ? `${left} days to go` : "Complete"}
      </div>
    </Link>
  );
}

function DiscoverCard({ protocol }: { protocol: Protocol }) {
  const enrollable = isProtocolEnrollable(protocol);
  const inner = (
    <>
      <CoverTile protocol={protocol} />
      <div className="min-w-0 flex-1">
        <div className="text-body font-semibold">{protocol.name}</div>
        <p className="mt-0.5 line-clamp-2 text-footnote text-[var(--muted)]">
          {protocol.tagline}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Chip>
            {PROTOCOL_CATEGORY_LABELS[protocol.category] ?? protocol.category}
          </Chip>
          <span className="text-caption text-[var(--muted)]">
            {formatDuration(protocol.duration_days)}
            {enrollable && ` · ${protocol.items.length} items`}
          </span>
          {!enrollable && <Chip>Coming soon</Chip>}
          {protocol.pricing_cents > 0 && (
            <Chip tone="premium">
              ${(protocol.pricing_cents / 100).toFixed(0)}
            </Chip>
          )}
        </div>
      </div>
      {enrollable && (
        <Icon name="chevron-right" size={18} strokeWidth={2} className="mt-1 shrink-0 text-[var(--muted)]" />
      )}
    </>
  );

  return enrollable ? (
    <Link
      href={`/protocols/${protocol.slug}`}
      className={cardClass({ padding: "md", interactive: true, className: "flex items-start gap-3" })}
    >
      {inner}
    </Link>
  ) : (
    <div
      className={cardClass({ padding: "md", className: "flex items-start gap-3 opacity-60" })}
      aria-disabled
    >
      {inner}
    </div>
  );
}
