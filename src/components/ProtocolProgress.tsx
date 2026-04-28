"use client";

// ProtocolProgress — small horizontal card showing the user's most relevant
// active protocol enrollment with day-counter + progress bar. Lives at the
// top of /today so users always see their current protocol context.
//
// If multiple enrollments, the one with the highest urgency / most-recent
// activity shows; tap to see the full /protocols list.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getEnrollments } from "@/lib/storage";
import { listProtocols, formatDuration } from "@/lib/protocols";
import Icon from "@/components/Icon";

type Enrollment = {
  id: string;
  protocol_slug: string;
  enrolled_at: string;
  start_date: string;
  status: string;
};

export default function ProtocolProgress() {
  const protocols = useMemo(() => listProtocols(), []);
  const [enrollments, setEnrollments] = useState<Enrollment[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await getEnrollments();
        if (alive) setEnrollments(list);
      } catch {
        if (alive) setEnrollments([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (enrollments === null) return null;
  const active = enrollments.filter((e) => e.status === "active");
  if (active.length === 0) return null;

  return (
    <section className="mb-6">
      {active.length > 1 && (
        <div className="flex items-baseline justify-between mb-2">
          <h2
            className="text-[11px] uppercase tracking-wider"
            style={{
              color: "var(--muted)",
              fontWeight: 600,
              letterSpacing: "0.06em",
            }}
          >
            Your protocols
          </h2>
          <Link
            href="/protocols"
            className="text-[11px] flex items-center gap-1"
            style={{ color: "var(--muted)" }}
          >
            All
            <Icon name="chevron-right" size={11} strokeWidth={2} />
          </Link>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {active.map((e) => {
          const protocol = protocols.find((p) => p.slug === e.protocol_slug);
          if (!protocol) return null;
          const start = new Date(e.start_date);
          const dayN =
            Math.max(
              0,
              Math.floor((Date.now() - start.getTime()) / 86400000),
            ) + 1;
          const total = protocol.duration_days;
          const pct = Math.min(100, Math.round((dayN / total) * 100));
          const remaining = Math.max(0, total - dayN);

          return (
            <Link
              key={e.id}
              href={`/protocols/${e.protocol_slug}`}
              className="rounded-2xl card-glass p-4 pressable flex items-center gap-3"
            >
              <span
                className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center text-[20px]"
                style={{
                  background: "var(--olive-tint)",
                }}
                aria-hidden
              >
                {protocol.cover_emoji ?? "📋"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <div
                    className="text-[14px] truncate"
                    style={{ fontWeight: 500 }}
                  >
                    {protocol.name}
                  </div>
                  <div className="text-[12px] tabular-nums shrink-0">
                    <span
                      style={{
                        color: "var(--olive)",
                        fontWeight: 600,
                      }}
                    >
                      Day {dayN}
                    </span>
                    <span style={{ color: "var(--muted)" }}>
                      {" / "}
                      {total}
                    </span>
                  </div>
                </div>
                <div
                  className="h-1 rounded-full overflow-hidden"
                  style={{ background: "var(--surface-alt)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: "var(--olive)",
                    }}
                  />
                </div>
                <div
                  className="text-[11px] mt-1.5"
                  style={{ color: "var(--muted)" }}
                >
                  {remaining > 0
                    ? `${formatDuration(remaining)} remaining`
                    : "Protocol complete"}
                </div>
              </div>
              <Icon
                name="chevron-right"
                size={14}
                className="shrink-0 opacity-40"
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
