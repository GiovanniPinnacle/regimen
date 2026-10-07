// /reviews — every scheduled checkpoint, derived from real user data:
//   1. Items with a review_trigger set (e.g., "Day 14+", "Month 3 panel")
//   2. Active protocol enrollments → milestones from each protocol's
//      expected_timeline + phases
//   3. Items expiring soon (ends_on within 30 days)
//
// No hardcoded user-specific schedule.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listProtocols } from "@/lib/protocols";
import type { Item } from "@/lib/types";
import Icon from "@/components/Icon";
import EmptyGlyph from "@/components/EmptyGlyph";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { ListGroup } from "@/components/ui/ListRow";
import { SectionHeader } from "@/components/ui/Section";

export const dynamic = "force-dynamic";

type Checkpoint = {
  date?: string;
  marker: string;
  title: string;
  detail: string;
  href?: string;
  source: "item" | "protocol_milestone" | "protocol_phase" | "expiring";
};

function getNow(): number {
  return Date.now();
}

export default async function ReviewsPage() {
  const supabase = await createClient();
  const NOW = getNow();

  const [itemsRes, enrollRes] = await Promise.all([
    supabase
      .from("items")
      .select("id, name, brand, status, review_trigger, ends_on, item_type")
      .in("status", ["active", "queued"]),
    supabase
      .from("protocol_enrollments")
      .select("protocol_slug, start_date, status")
      .eq("status", "active"),
  ]);

  const items = (itemsRes.data ?? []) as Item[];
  const enrollments = (enrollRes.data ?? []) as {
    protocol_slug: string;
    start_date: string;
    status: string;
  }[];

  const checkpoints: Checkpoint[] = [];

  // 1. Items with explicit review_trigger
  for (const item of items) {
    if (item.review_trigger) {
      checkpoints.push({
        marker: item.review_trigger,
        title: item.name,
        detail: `Revisit: ${item.review_trigger}`,
        href: `/items/${item.id}`,
        source: "item",
      });
    }
    // Items with ends_on within 30 days
    if (item.ends_on) {
      const endsAt = new Date(item.ends_on);
      const daysUntil = Math.floor(
        (endsAt.getTime() - NOW) / 86400000,
      );
      if (daysUntil >= 0 && daysUntil <= 30) {
        checkpoints.push({
          date: item.ends_on,
          marker: daysUntil === 0 ? "Today" : `In ${daysUntil}d`,
          title: `${item.name} ends`,
          detail: "This cycle is wrapping up. Decide whether to keep going, swap, or stop.",
          href: `/items/${item.id}`,
          source: "expiring",
        });
      }
    }
  }

  // 2. Protocol milestones
  for (const enroll of enrollments) {
    const protocol = listProtocols().find((p) => p.slug === enroll.protocol_slug);
    if (!protocol) continue;
    const startMs = new Date(enroll.start_date).getTime();

    for (const milestone of protocol.expected_timeline ?? []) {
      const dateMs = startMs + milestone.starts_on_day * 86400000;
      // Only future or recent (within last 7 days) milestones
      const daysFromNow = Math.floor((dateMs - NOW) / 86400000);
      if (daysFromNow < -7 || daysFromNow > 365) continue;

      checkpoints.push({
        date: new Date(dateMs).toISOString().slice(0, 10),
        marker:
          daysFromNow > 0
            ? `In ${daysFromNow}d`
            : daysFromNow === 0
              ? "Today"
              : `${-daysFromNow}d ago`,
        title: `${protocol.name} · ${milestone.marker}`,
        detail: milestone.expect,
        href: `/protocols/${protocol.slug}`,
        source: "protocol_milestone",
      });
    }

    // Phase transitions
    for (const phase of protocol.phases ?? []) {
      const phaseStart = startMs + phase.starts_on_day * 86400000;
      const daysFromNow = Math.floor((phaseStart - NOW) / 86400000);
      if (daysFromNow < 0 || daysFromNow > 365) continue;

      checkpoints.push({
        date: new Date(phaseStart).toISOString().slice(0, 10),
        marker: daysFromNow === 0 ? "Today" : `In ${daysFromNow}d`,
        title: `${protocol.name} · ${phase.label}`,
        detail: phase.summary,
        href: `/protocols/${protocol.slug}`,
        source: "protocol_phase",
      });
    }
  }

  // Sort: items with dates first (chronological), then dateless review_triggers
  checkpoints.sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.title.localeCompare(b.title);
  });

  // Group by source for cleaner sections
  const dated = checkpoints.filter((c) => c.date);
  const undated = checkpoints.filter((c) => !c.date);

  return (
    <div className="pb-24">
      <PageHeader
        title="Check-ins"
        back="/you"
        backLabel="You"
        subtitle="Milestones, items wrapping up, and decisions to revisit, all pulled from your stack and programs."
      />

      {checkpoints.length === 0 ? (
        <Card padding="xl" className="flex flex-col items-center text-center">
          <EmptyGlyph icon="calendar" tone="muted" size={64} />
          <div className="mt-4 text-title-3">Nothing scheduled</div>
          <p className="mt-1 text-callout text-[var(--muted)]">
            Check-ins show up when you set a revisit note on an item, when a
            program milestone is coming up, or when an item ends within 30
            days.
          </p>
          <ButtonLink
            href="/protocols"
            className="mt-5"
            iconRight="chevron-right"
          >
            Browse protocols
          </ButtonLink>
        </Card>
      ) : (
        <>
          {dated.length > 0 && (
            <section>
              <SectionHeader
                className="mt-0"
                title="Coming up"
                action={
                  <span className="shrink-0 text-footnote tabular-nums text-[var(--muted)]">
                    {dated.length}
                  </span>
                }
              />
              <ListGroup>
                {dated.map((c, i) => (
                  <CheckpointRow key={`${c.title}-${i}`} cp={c} />
                ))}
              </ListGroup>
            </section>
          )}

          {undated.length > 0 && (
            <section>
              <SectionHeader
                className={dated.length > 0 ? "" : "mt-0"}
                eyebrow="When something happens, not on a date"
                title="Revisit later"
                action={
                  <span className="shrink-0 text-footnote tabular-nums text-[var(--muted)]">
                    {undated.length}
                  </span>
                }
              />
              <ListGroup>
                {undated.map((c, i) => (
                  <CheckpointRow key={`${c.title}-${i}`} cp={c} />
                ))}
              </ListGroup>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function CheckpointRow({ cp }: { cp: Checkpoint }) {
  const urgent = cp.source === "expiring";
  const inner = (
    <>
      <div className="w-16 shrink-0 pt-0.5">
        <div
          className={`text-footnote font-semibold tabular-nums ${urgent ? "text-[var(--warn)]" : "text-[var(--foreground)]"}`}
        >
          {cp.marker}
        </div>
        {cp.date && (
          <div className="mt-0.5 text-caption text-[var(--muted)]">
            {new Date(cp.date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-callout font-semibold leading-snug">
          {cp.title}
        </div>
        <div className="mt-0.5 text-footnote leading-relaxed text-[var(--muted)]">
          {cp.detail}
        </div>
      </div>
      {cp.href && (
        <Icon
          name="chevron-right"
          size={16}
          strokeWidth={2}
          className="mt-0.5 shrink-0 self-center text-[var(--muted)]"
        />
      )}
    </>
  );
  const cls =
    "flex min-h-[52px] items-start gap-3 px-4 py-3 transition-colors";
  if (cp.href) {
    return (
      <Link href={cp.href} className={`${cls} active:bg-[var(--surface-alt)]`}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}
