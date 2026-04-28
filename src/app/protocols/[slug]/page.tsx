"use client";

// /protocols/[slug] — protocol detail with full description, timeline,
// items, safety, and the enroll button.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  getProtocol,
  isProtocolEnrollable,
  formatDuration,
  PROTOCOL_CATEGORY_LABELS,
} from "@/lib/protocols";
import { getEnrollment } from "@/lib/storage";
import { TIMING_LABELS, ITEM_TYPE_LABELS } from "@/lib/constants";

export default function ProtocolDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const protocol = useMemo(
    () => getProtocol(params.slug),
    [params.slug],
  );

  const [enrollment, setEnrollment] = useState<{
    id: string;
    protocol_slug: string;
    enrolled_at: string;
    start_date: string;
    status: string;
  } | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);

  useEffect(() => {
    (async () => {
      if (!protocol) return;
      try {
        const e = await getEnrollment(protocol.slug);
        setEnrollment(e);
      } catch {
        // not signed in or no DB access
      }
    })();
  }, [protocol]);

  if (!protocol) {
    return (
      <div className="py-12 text-center" style={{ color: "var(--muted)" }}>
        Protocol not found.{" "}
        <Link href="/protocols" className="underline">
          Browse all
        </Link>
      </div>
    );
  }

  const enrollable = isProtocolEnrollable(protocol);
  const startDate = enrollment ? new Date(enrollment.start_date) : null;
  const dayN = startDate
    ? Math.max(
        0,
        Math.floor((Date.now() - startDate.getTime()) / 86400000),
      ) + 1
    : 0;

  async function enroll() {
    if (!protocol) return;
    setEnrolling(true);
    setErr(null);
    try {
      const res = await fetch("/api/protocols/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: protocol.slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setConfirmed(true);
      // After 1.5s redirect to /today
      setTimeout(() => router.push("/today"), 1500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setEnrolling(false);
    }
  }

  async function unenroll(removeItems: boolean) {
    if (!protocol) return;
    const confirm = window.confirm(
      removeItems
        ? `Cancel enrollment and retire all ${protocol.items.length} linked items?\n\nYour reaction history and logs are preserved — items just won't appear on Today anymore.`
        : `Cancel enrollment but keep items active?\n\nItems stay on Today; you'll just no longer be tracked as enrolled in this protocol.`,
    );
    if (!confirm) return;
    setUnenrolling(true);
    setErr(null);
    try {
      const res = await fetch("/api/protocols/unenroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: protocol.slug,
          remove_items: removeItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      setEnrollment(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUnenrolling(false);
    }
  }

  const itemsBySlot = protocol.items.reduce(
    (acc, item) => {
      const slot = item.timing_slot;
      if (!acc[slot]) acc[slot] = [];
      acc[slot].push(item);
      return acc;
    },
    {} as Record<string, typeof protocol.items>,
  );

  return (
    <div className="pb-24">
      <div className="mb-4">
        <Link
          href="/protocols"
          className="text-[12px]"
          style={{ color: "var(--muted)" }}
        >
          ← All protocols
        </Link>
      </div>

      <header className="mb-6">
        <div className="flex items-start gap-4 mb-4">
          <div
            className="text-[40px] leading-none shrink-0 h-16 w-16 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--olive-tint)" }}
            aria-hidden
          >
            {protocol.cover_emoji ?? "📋"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                style={{
                  background: "var(--olive-tint)",
                  color: "var(--olive)",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                }}
              >
                {PROTOCOL_CATEGORY_LABELS[protocol.category] ??
                  protocol.category}
              </span>
              <span
                className="text-[11px]"
                style={{ color: "var(--muted)" }}
              >
                {formatDuration(protocol.duration_days)}
              </span>
              {protocol.pricing_cents > 0 ? (
                <span
                  className="text-[11px] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: "rgba(107, 91, 205, 0.12)",
                    color: "var(--purple, #6B5BCD)",
                    fontWeight: 600,
                  }}
                >
                  ${(protocol.pricing_cents / 100).toFixed(0)}
                </span>
              ) : (
                <span
                  className="text-[11px]"
                  style={{ color: "var(--olive)", fontWeight: 600 }}
                >
                  Free
                </span>
              )}
              {protocol.is_official && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: "var(--olive)",
                    color: "#FBFAF6",
                    fontWeight: 600,
                  }}
                >
                  Official
                </span>
              )}
            </div>
            <h1
              className="text-[24px] leading-tight"
              style={{ fontWeight: 500 }}
            >
              {protocol.name}
            </h1>
            <p
              className="text-[13px] mt-1"
              style={{ color: "var(--muted)" }}
            >
              by {protocol.author.name}
              {protocol.author.credentials &&
                ` · ${protocol.author.credentials}`}
            </p>
          </div>
        </div>

        <p
          className="text-[15px] leading-relaxed"
          style={{ color: "var(--foreground)", opacity: 0.85 }}
        >
          {protocol.description}
        </p>
      </header>

      {/* Enroll CTA */}
      <section className="mb-6">
        {confirmed ? (
          <div
            className="rounded-2xl p-5 text-center"
            style={{
              background: "var(--olive)",
              color: "#FBFAF6",
            }}
          >
            <div
              className="text-[14px]"
              style={{ fontWeight: 600 }}
            >
              ✓ Enrolled. Items added to /today.
            </div>
            <div className="text-[12px] mt-1" style={{ opacity: 0.85 }}>
              Redirecting…
            </div>
          </div>
        ) : enrollment && enrollment.status === "active" ? (
          <>
          <div
            className="rounded-2xl p-5 flex items-center justify-between gap-3"
            style={{
              background: "var(--olive-tint)",
              border: "1px solid rgba(123, 139, 90, 0.35)",
            }}
          >
            <div>
              <div
                className="text-[14px]"
                style={{ fontWeight: 600, color: "var(--olive)" }}
              >
                Enrolled — Day {dayN}
              </div>
              <div
                className="text-[12px] mt-0.5"
                style={{ color: "var(--foreground)", opacity: 0.75 }}
              >
                Items live on /today. {protocol.duration_days - dayN > 0
                  ? `${protocol.duration_days - dayN} days remaining.`
                  : "Protocol complete."}
              </div>
            </div>
            <Link
              href="/today"
              className="text-[13px] px-3.5 py-2 rounded-xl shrink-0"
              style={{
                background: "var(--olive)",
                color: "#FBFAF6",
                fontWeight: 500,
              }}
            >
              Today →
            </Link>
          </div>
          {/* Cancel-enrollment row — subtle, below the success card */}
          <div className="flex items-center justify-end gap-3 mt-2 px-1">
            <button
              onClick={() => unenroll(false)}
              disabled={unenrolling}
              className="text-[11px]"
              style={{ color: "var(--muted)", textDecoration: "underline" }}
            >
              Cancel (keep items)
            </button>
            <button
              onClick={() => unenroll(true)}
              disabled={unenrolling}
              className="text-[11px]"
              style={{ color: "var(--error)", textDecoration: "underline" }}
            >
              {unenrolling ? "Cancelling…" : "Cancel + retire items"}
            </button>
          </div>
          </>
        ) : enrollable ? (
          <button
            onClick={enroll}
            disabled={enrolling}
            className="w-full rounded-2xl px-5 py-4 text-[15px]"
            style={{
              background: "var(--olive)",
              color: "#FBFAF6",
              fontWeight: 500,
              opacity: enrolling ? 0.6 : 1,
              boxShadow: "0 4px 14px rgba(74, 82, 48, 0.25)",
            }}
          >
            {enrolling
              ? "Enrolling…"
              : `Enroll → adds ${protocol.items.length} items to /today`}
          </button>
        ) : (
          <div
            className="rounded-2xl p-5 text-center"
            style={{
              background: "var(--surface-alt)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="text-[14px]"
              style={{ fontWeight: 500 }}
            >
              Coming soon
            </div>
            <div
              className="text-[12px] mt-1"
              style={{ color: "var(--muted)" }}
            >
              This protocol is being authored. Check back shortly.
            </div>
          </div>
        )}
        {err && (
          <div
            className="text-[13px] mt-3 p-3 rounded-lg"
            style={{
              background: "rgba(176, 0, 32, 0.08)",
              color: "#b00020",
            }}
          >
            {err}
          </div>
        )}
      </section>

      {/* Phases */}
      {protocol.phases && protocol.phases.length > 0 && (
        <Section title="Phases">
          <div className="flex flex-col gap-3">
            {protocol.phases.map((p) => (
              <div
                key={p.label}
                className="rounded-2xl p-4 card-glass"
              >
                <div
                  className="text-[12px] uppercase tracking-wider mb-1"
                  style={{ color: "var(--olive)", fontWeight: 600 }}
                >
                  {p.label}
                </div>
                <div
                  className="text-[13px] leading-relaxed"
                  style={{ color: "var(--foreground)", opacity: 0.85 }}
                >
                  {p.summary}
                </div>
                {p.what_to_expect && p.what_to_expect.length > 0 && (
                  <div className="mt-2">
                    <div
                      className="text-[11px] uppercase tracking-wider mb-1"
                      style={{ color: "var(--muted)", fontWeight: 500 }}
                    >
                      What to expect
                    </div>
                    <ul
                      className="text-[12px] flex flex-col gap-1"
                      style={{ color: "var(--muted)" }}
                    >
                      {p.what_to_expect.map((w) => (
                        <li key={w}>· {w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {p.red_flags && p.red_flags.length > 0 && (
                  <div
                    className="mt-2 p-2 rounded-lg"
                    style={{
                      background: "rgba(176, 0, 32, 0.05)",
                      border: "1px solid rgba(176, 0, 32, 0.2)",
                    }}
                  >
                    <div
                      className="text-[11px] uppercase tracking-wider mb-1"
                      style={{ color: "#b00020", fontWeight: 600 }}
                    >
                      Red flags
                    </div>
                    <ul
                      className="text-[12px] flex flex-col gap-1"
                      style={{ color: "#b00020" }}
                    >
                      {p.red_flags.map((r) => (
                        <li key={r}>· {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Expected Timeline */}
      {protocol.expected_timeline.length > 0 && (
        <Section title="Expected timeline">
          <div className="flex flex-col gap-2">
            {protocol.expected_timeline.map((t) => (
              <div
                key={t.marker}
                className="rounded-xl p-3 flex gap-3 items-start"
                style={{
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  className="text-[12px] uppercase tracking-wider shrink-0 px-2 py-0.5 rounded-full"
                  style={{
                    background: "var(--olive-tint)",
                    color: "var(--olive)",
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                  }}
                >
                  {t.marker}
                </div>
                <div className="flex-1">
                  <div className="text-[13px] leading-relaxed">
                    {t.expect}
                  </div>
                  {t.evidence && (
                    <div
                      className="text-[11px] mt-1 italic"
                      style={{ color: "var(--muted)" }}
                    >
                      {t.evidence}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Items by timing slot */}
      <Section title={`Items in this protocol (${protocol.items.length})`}>
        <div className="flex flex-col gap-3">
          {Object.entries(itemsBySlot).map(([slot, items]) => (
            <div key={slot}>
              <div
                className="text-[10px] uppercase tracking-wider mb-1.5"
                style={{ color: "var(--muted)", fontWeight: 500 }}
              >
                {TIMING_LABELS[slot as keyof typeof TIMING_LABELS] ?? slot}
              </div>
              <div className="flex flex-col gap-1.5">
                {items.map((it) => (
                  <div
                    key={it.key}
                    className="rounded-xl p-3"
                    style={{
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <div
                        className="text-[14px]"
                        style={{ fontWeight: 500 }}
                      >
                        {it.name}
                      </div>
                      <div
                        className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                        style={{
                          background: "var(--surface-alt)",
                          color: "var(--muted)",
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {ITEM_TYPE_LABELS[it.item_type] ?? it.item_type}
                      </div>
                    </div>
                    <div
                      className="text-[12px]"
                      style={{ color: "var(--muted)" }}
                    >
                      {[it.dose, it.brand].filter(Boolean).join(" · ")}
                    </div>
                    <div
                      className="text-[11px] mt-1"
                      style={{ color: "var(--olive)", fontWeight: 500 }}
                    >
                      {it.starts_on_day != null && it.starts_on_day > 0
                        ? `Starts Day ${it.starts_on_day}`
                        : "Starts immediately"}
                      {it.ends_on_day != null
                        ? ` · Ends Day ${it.ends_on_day}`
                        : ""}
                    </div>
                    {it.usage_notes && (
                      <div
                        className="text-[12px] mt-1.5 leading-relaxed"
                        style={{
                          color: "var(--foreground)",
                          opacity: 0.8,
                        }}
                      >
                        {it.usage_notes}
                      </div>
                    )}
                    {it.research_summary && (
                      <div
                        className="text-[11px] mt-2 pt-2 leading-relaxed italic"
                        style={{
                          color: "var(--muted)",
                          borderTop: "1px solid var(--border)",
                        }}
                      >
                        {it.research_summary}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Safety */}
      <Section title="Safety">
        <div
          className="rounded-2xl p-4"
          style={{
            background: "rgba(194, 145, 66, 0.08)",
            border: "1px solid rgba(194, 145, 66, 0.25)",
          }}
        >
          <p
            className="text-[13px] leading-relaxed"
            style={{ color: "var(--foreground)", opacity: 0.9 }}
          >
            {protocol.safety_notes}
          </p>
          {protocol.contraindications &&
            protocol.contraindications.length > 0 && (
              <div className="mt-3">
                <div
                  className="text-[11px] uppercase tracking-wider mb-1"
                  style={{ color: "#C29142", fontWeight: 600 }}
                >
                  Contraindications
                </div>
                <ul
                  className="text-[12px] flex flex-col gap-0.5"
                  style={{ color: "var(--muted)" }}
                >
                  {protocol.contraindications.map((c) => (
                    <li key={c}>· {c}</li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      </Section>

      {/* Research summary */}
      {protocol.research_summary && (
        <Section title="The research, briefly">
          <div
            className="rounded-2xl p-4 card-glass"
          >
            <p
              className="text-[13px] leading-relaxed"
              style={{
                color: "var(--foreground)",
                opacity: 0.85,
              }}
            >
              {protocol.research_summary}
            </p>
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2
        className="text-[11px] uppercase tracking-wider mb-3"
        style={{ color: "var(--muted)", fontWeight: 500 }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
