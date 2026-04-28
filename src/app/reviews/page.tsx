// /reviews — every scheduled checkpoint, derived from real user data:
//   1. Items with a review_trigger set (e.g., "Day 14+", "Month 3 panel")
//   2. Active protocol enrollments → milestones from each protocol's
//      expected_timeline + phases
//   3. Items expiring soon (ends_on within 30 days)
//
// No hardcoded user-specific schedule.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listProtocols, formatDuration } from "@/lib/protocols";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";

type Checkpoint = {
  date?: string;
  marker: string;
  title: string;
  detail: string;
  href?: string;
  source: "item" | "protocol_milestone" | "protocol_phase" | "expiring";
};

export default async function ReviewsPage() {
  const supabase = await createClient();

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
        detail: `Review trigger: ${item.review_trigger}`,
        href: `/items/${item.id}`,
        source: "item",
      });
    }
    // Items with ends_on within 30 days
    if (item.ends_on) {
      const endsAt = new Date(item.ends_on);
      const daysUntil = Math.floor(
        (endsAt.getTime() - Date.now()) / 86400000,
      );
      if (daysUntil >= 0 && daysUntil <= 30) {
        checkpoints.push({
          date: item.ends_on,
          marker: daysUntil === 0 ? "Today" : `In ${daysUntil}d`,
          title: `${item.name} ends`,
          detail: `${item.item_type} cycle wraps. Decide: continue, swap, or drop.`,
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
      const daysFromNow = Math.floor((dateMs - Date.now()) / 86400000);
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
      const daysFromNow = Math.floor((phaseStart - Date.now()) / 86400000);
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
      <header className="mb-7">
        <h1
          className="text-[32px] leading-tight"
          style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          Reviews
        </h1>
        <p
          className="text-[13px] mt-1 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Scheduled checkpoints — protocol milestones, items expiring,
          decisions to revisit. Pulled from your real stack + enrollments.
        </p>
      </header>

      {checkpoints.length === 0 ? (
        <div
          className="rounded-2xl card-glass p-8 text-center max-w-md mx-auto"
        >
          <div
            className="text-[15px] mb-1"
            style={{ fontWeight: 500 }}
          >
            No reviews scheduled
          </div>
          <div
            className="text-[13px] leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            Reviews surface automatically when items have a review trigger
            (e.g., &quot;Day 30 reassess&quot;), when protocol milestones approach,
            or when an item&apos;s end date is within 30 days.
          </div>
          <Link
            href="/protocols"
            className="inline-block mt-4 text-[13px] px-4 py-2 rounded-xl"
            style={{
              background: "var(--accent)",
              color: "#FBFAF6",
              fontWeight: 500,
            }}
          >
            Enroll in a protocol →
          </Link>
        </div>
      ) : (
        <>
          {dated.length > 0 && (
            <section className="mb-7">
              <h2
                className="text-[11px] uppercase tracking-wider mb-3"
                style={{
                  color: "var(--muted)",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                }}
              >
                Upcoming · {dated.length}
              </h2>
              <div className="rounded-2xl card-glass overflow-hidden">
                {dated.map((c, i) => (
                  <CheckpointRow
                    key={`${c.title}-${i}`}
                    cp={c}
                    isLast={i === dated.length - 1}
                  />
                ))}
              </div>
            </section>
          )}

          {undated.length > 0 && (
            <section className="mb-7">
              <h2
                className="text-[11px] uppercase tracking-wider mb-3"
                style={{
                  color: "var(--muted)",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                }}
              >
                Conditional triggers · {undated.length}
              </h2>
              <p
                className="text-[12px] mb-3 leading-relaxed"
                style={{ color: "var(--muted)" }}
              >
                Triggered by an event, not a date.
              </p>
              <div className="rounded-2xl card-glass overflow-hidden">
                {undated.map((c, i) => (
                  <CheckpointRow
                    key={`${c.title}-${i}`}
                    cp={c}
                    isLast={i === undated.length - 1}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function CheckpointRow({
  cp,
  isLast,
}: {
  cp: Checkpoint;
  isLast: boolean;
}) {
  const inner = (
    <div
      className="px-4 py-3.5 flex items-start gap-3"
      style={{
        borderBottom: isLast ? undefined : "1px solid var(--border)",
      }}
    >
      <div className="shrink-0 w-16 text-right">
        <div
          className="text-[11px] tabular-nums"
          style={{
            color:
              cp.source === "expiring"
                ? "var(--warn)"
                : "var(--accent)",
            fontWeight: 600,
          }}
        >
          {cp.marker}
        </div>
        {cp.date && (
          <div
            className="text-[10px] mt-0.5"
            style={{ color: "var(--muted)" }}
          >
            {new Date(cp.date).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="text-[14px] leading-snug"
          style={{ fontWeight: 500 }}
        >
          {cp.title}
        </div>
        <div
          className="text-[12px] mt-0.5 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          {cp.detail}
        </div>
      </div>
    </div>
  );
  if (cp.href) {
    return (
      <Link href={cp.href} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}
