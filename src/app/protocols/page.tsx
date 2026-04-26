"use client";

// /protocols — browse all available protocols.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  listProtocols,
  formatDuration,
  isProtocolEnrollable,
  PROTOCOL_CATEGORY_LABELS,
} from "@/lib/protocols";
import { getEnrollments } from "@/lib/storage";
import type { ProtocolCategory } from "@/lib/types";

const CATEGORIES: ("all" | ProtocolCategory)[] = [
  "all",
  "recovery",
  "fitness",
  "posture",
  "sleep",
  "metabolic",
];

export default function ProtocolsBrowsePage() {
  const protocols = useMemo(() => listProtocols(), []);
  const [enrollments, setEnrollments] = useState<
    {
      protocol_slug: string;
      start_date: string;
      status: string;
    }[]
  >([]);
  const [filter, setFilter] = useState<"all" | ProtocolCategory>("all");

  useEffect(() => {
    (async () => {
      try {
        const list = await getEnrollments();
        setEnrollments(list);
      } catch {
        // Not signed in or no DB access — fine, just no enrollment chips
      }
    })();
  }, []);

  const filtered = filter === "all"
    ? protocols
    : protocols.filter((p) => p.category === filter);

  const enrolledMap = new Map(
    enrollments
      .filter((e) => e.status === "active")
      .map((e) => [e.protocol_slug, e]),
  );

  return (
    <div className="pb-24">
      <header className="mb-6">
        <div
          className="text-[11px] uppercase tracking-wider mb-2"
          style={{ color: "var(--muted)", fontWeight: 500 }}
        >
          Regimen Protocols
        </div>
        <h1
          className="text-[28px] leading-tight"
          style={{ fontWeight: 500 }}
        >
          Prebuilt regimens, refined to you.
        </h1>
        <p
          className="text-[14px] mt-2 leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Pick a protocol — supps, practices, exercises, food guidance — all
          day-gated and research-backed. Enroll once and items auto-populate
          your /today as their day arrives. Claude refines the protocol to
          your data as you go.
        </p>
      </header>

      {/* Filter chips */}
      <div className="-mx-4 mb-5">
        <div
          className="flex gap-2 px-4 overflow-x-auto pb-1"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className="shrink-0 text-[12px] px-3 py-1.5 rounded-full transition-all"
              style={{
                background:
                  filter === c ? "var(--olive)" : "var(--surface)",
                color: filter === c ? "#FBFAF6" : "var(--foreground)",
                border:
                  filter === c
                    ? "1px solid var(--olive)"
                    : "1px solid var(--border)",
                fontWeight: filter === c ? 600 : 500,
              }}
            >
              {c === "all" ? "All" : PROTOCOL_CATEGORY_LABELS[c] ?? c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map((p) => {
          const enrollable = isProtocolEnrollable(p);
          const enrolled = enrolledMap.get(p.slug);
          const startDate = enrolled
            ? new Date(enrolled.start_date)
            : null;
          const dayN = startDate
            ? Math.max(
                0,
                Math.floor(
                  (Date.now() - startDate.getTime()) / 86400000,
                ),
              ) + 1
            : 0;

          return (
            <Link
              key={p.slug}
              href={`/protocols/${p.slug}`}
              className="rounded-2xl card-glass p-4 flex gap-3 items-start"
              style={{
                opacity: enrollable ? 1 : 0.85,
              }}
            >
              <div
                className="text-[32px] leading-none shrink-0 h-12 w-12 rounded-xl flex items-center justify-center"
                style={{
                  background: enrollable
                    ? "var(--olive-tint)"
                    : "var(--surface-alt)",
                }}
                aria-hidden
              >
                {p.cover_emoji ?? "📋"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                    style={{
                      background: "var(--olive-tint)",
                      color: "var(--olive)",
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                    }}
                  >
                    {PROTOCOL_CATEGORY_LABELS[p.category] ?? p.category}
                  </span>
                  <span
                    className="text-[11px]"
                    style={{ color: "var(--muted)" }}
                  >
                    {formatDuration(p.duration_days)}
                  </span>
                  {p.pricing_cents > 0 && (
                    <span
                      className="text-[11px] px-1.5 py-0.5 rounded-full"
                      style={{
                        background: "rgba(107, 91, 205, 0.12)",
                        color: "var(--purple, #6B5BCD)",
                        fontWeight: 600,
                      }}
                    >
                      ${(p.pricing_cents / 100).toFixed(0)}
                    </span>
                  )}
                </div>
                <div
                  className="text-[15px] leading-snug"
                  style={{ fontWeight: 500 }}
                >
                  {p.name}
                </div>
                <div
                  className="text-[13px] mt-0.5 leading-relaxed"
                  style={{ color: "var(--muted)" }}
                >
                  {p.tagline}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {enrolled ? (
                    <span
                      className="text-[11px] px-2 py-1 rounded-full"
                      style={{
                        background: "var(--olive)",
                        color: "#FBFAF6",
                        fontWeight: 600,
                      }}
                    >
                      Enrolled · Day {dayN}
                    </span>
                  ) : enrollable ? (
                    <span
                      className="text-[11px]"
                      style={{ color: "var(--olive)", fontWeight: 600 }}
                    >
                      {p.items.length} items · ready to enroll →
                    </span>
                  ) : (
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{
                        background: "var(--surface-alt)",
                        color: "var(--muted)",
                        fontWeight: 600,
                      }}
                    >
                      Coming soon
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <section
        className="mt-10 rounded-2xl p-5"
        style={{
          background: "var(--olive-tint)",
          border: "1px solid rgba(123, 139, 90, 0.25)",
        }}
      >
        <div
          className="text-[11px] uppercase tracking-wider mb-2"
          style={{ color: "var(--olive)", fontWeight: 600 }}
        >
          How protocols work
        </div>
        <ul
          className="text-[13px] flex flex-col gap-1.5 leading-relaxed"
          style={{ color: "var(--foreground)", opacity: 0.9 }}
        >
          <li>
            ·{" "}
            <strong>Day-gated.</strong> Items appear on /today when their day
            opens (e.g., minoxidil unlocks on Day 14, microneedling on Day 30).
          </li>
          <li>
            · <strong>Research-backed.</strong> Each item cites why and when it
            should help. No vibes.
          </li>
          <li>
            · <strong>Refinement-first.</strong> Claude reads your skips +
            reactions and recommends drops as you go.
          </li>
          <li>
            · <strong>Stackable.</strong> Enroll in multiple protocols. They
            merge cleanly on /today.
          </li>
          <li>
            · <strong>Customizable.</strong> Edit any item after enrollment.
            The protocol is a starting line, not a cage.
          </li>
        </ul>
      </section>
    </div>
  );
}
