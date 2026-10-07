"use client";

// /protocols/[slug] — protocol detail: what it is, enroll, phases,
// timeline, items by time of day, safety and research.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  getProtocol,
  isProtocolEnrollable,
  formatDuration,
  protocolIcon,
  PROTOCOL_CATEGORY_LABELS,
} from "@/lib/protocols";
import { getEnrollment } from "@/lib/storage";
import { TIMING_LABELS, TIMING_ORDER, ITEM_TYPE_LABELS } from "@/lib/constants";
import type { TimingSlot } from "@/lib/types";
import Icon from "@/components/Icon";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import Button, { ButtonLink } from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import { SectionHeader } from "@/components/ui/Section";
import EmptyState from "@/components/EmptyState";

type Enrollment = {
  id: string;
  protocol_slug: string;
  enrolled_at: string;
  start_date: string;
  status: string;
};

export default function ProtocolDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const protocol = useMemo(() => getProtocol(params.slug), [params.slug]);

  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!protocol) return;
    getEnrollment(protocol.slug)
      .then(setEnrollment)
      .catch(() => {});
  }, [protocol]);

  if (!protocol) {
    return (
      <div className="pt-6">
        <PageHeader back="/protocols" backLabel="Protocols" title="Not found" />
        <EmptyState
          glyph="search"
          title="We couldn't find that protocol"
          primary={{ label: "Browse protocols", href: "/protocols" }}
        />
      </div>
    );
  }

  const enrollable = isProtocolEnrollable(protocol);
  const active = enrollment?.status === "active";
  const dayN = enrollment
    ? Math.max(
        0,
        Math.floor((now - new Date(enrollment.start_date).getTime()) / 86400000),
      ) + 1
    : 0;
  const left = protocol.duration_days - dayN;

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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't start this protocol.");
      setConfirmed(true);
      window.dispatchEvent(new CustomEvent("regimen:items-changed"));
      setTimeout(() => router.push("/today"), 1200);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setEnrolling(false);
    }
  }

  async function unenroll(removeItems: boolean) {
    if (!protocol) return;
    setUnenrolling(true);
    setErr(null);
    try {
      const res = await fetch("/api/protocols/unenroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: protocol.slug, remove_items: removeItems }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't stop this protocol.");
      setEnrollment(null);
      setStopOpen(false);
      window.dispatchEvent(new CustomEvent("regimen:items-changed"));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUnenrolling(false);
    }
  }

  const slots = TIMING_ORDER.map((slot) => ({
    slot,
    items: protocol.items.filter((i) => i.timing_slot === slot),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="pb-24">
      <PageHeader back="/protocols" backLabel="Protocols" title={protocol.name} />

      <div className="-mt-3 mb-5 flex flex-wrap items-center gap-1.5">
        <span
          aria-hidden
          className="mr-1 flex h-9 w-9 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--foreground-soft)]"
        >
          <Icon name={protocolIcon(protocol)} size={18} strokeWidth={1.8} />
        </span>
        <Chip>
          {PROTOCOL_CATEGORY_LABELS[protocol.category] ?? protocol.category}
        </Chip>
        <Chip>{formatDuration(protocol.duration_days)}</Chip>
        {enrollable && <Chip>{protocol.items.length} items</Chip>}
        {protocol.pricing_cents > 0 ? (
          <Chip tone="premium">
            ${(protocol.pricing_cents / 100).toFixed(0)}
          </Chip>
        ) : (
          <Chip>Free</Chip>
        )}
      </div>

      <p className="text-body text-[var(--foreground-soft)]">{protocol.description}</p>
      <p className="mt-2 text-footnote text-[var(--muted)]">
        By {protocol.author.name}
        {protocol.author.credentials && ` · ${protocol.author.credentials}`}
      </p>

      {/* Enroll / status */}
      <section className="mt-6">
        {confirmed ? (
          <Card tone="success" padding="md" className="flex items-center gap-3" role="status">
            <Icon name="check-circle" size={22} strokeWidth={2} className="shrink-0 text-[var(--success)]" />
            <div>
              <div className="text-body font-semibold">You&apos;re in</div>
              <div className="text-footnote text-[var(--foreground-soft)]">
                Items are on your Today. Taking you there…
              </div>
            </div>
          </Card>
        ) : active ? (
          <Card padding="md">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-body font-semibold">
                  Day {Math.min(dayN, protocol.duration_days)} of {protocol.duration_days}
                </div>
                <div className="text-footnote text-[var(--muted)]">
                  {left > 0 ? `${left} days to go` : "Complete"}
                </div>
              </div>
              <ButtonLink href="/today" size="sm" className="min-h-[44px]">
                Open Today
              </ButtonLink>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className={`h-full rounded-full ${left > 0 ? "bg-[var(--foreground)]" : "bg-[var(--success)]"}`}
                style={{
                  width: `${Math.min(100, Math.round((dayN / protocol.duration_days) * 100))}%`,
                }}
              />
            </div>
            <div className="mt-2 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setStopOpen(true)} className="min-h-[44px]">
                Stop following
              </Button>
            </div>
          </Card>
        ) : enrollable ? (
          <>
            <Button size="lg" fullWidth onClick={enroll} loading={enrolling}>
              Start protocol
            </Button>
            <p className="mt-2 text-center text-caption text-[var(--muted)]">
              Adds {protocol.items.length} items to Today, each on its day.
            </p>
          </>
        ) : (
          <Card padding="md" className="text-center">
            <div className="text-body font-semibold">Coming soon</div>
            <div className="mt-0.5 text-footnote text-[var(--muted)]">
              This one is still being written.
            </div>
          </Card>
        )}
        {err && (
          <p className="mt-3 text-footnote text-[var(--error)]" role="alert">
            {err}
          </p>
        )}
      </section>

      {protocol.phases && protocol.phases.length > 0 && (
        <Block title="Phases">
          <div className="flex flex-col gap-2.5">
            {protocol.phases.map((p) => (
              <Card key={p.label} padding="md">
                <div className="text-callout font-semibold">{p.label}</div>
                <p className="mt-1 text-footnote text-[var(--foreground-soft)]">{p.summary}</p>
                {p.what_to_expect && p.what_to_expect.length > 0 && (
                  <BulletList label="What to expect" items={p.what_to_expect} />
                )}
                {p.red_flags && p.red_flags.length > 0 && (
                  <Card tone="danger" padding="sm" className="mt-3">
                    <div className="flex items-center gap-1.5 text-caption font-semibold text-[var(--error)]">
                      <Icon name="alert" size={13} strokeWidth={2} />
                      Call your clinician if
                    </div>
                    <ul className="mt-1 flex flex-col gap-1 text-caption text-[var(--foreground-soft)]">
                      {p.red_flags.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </Card>
                )}
              </Card>
            ))}
          </div>
        </Block>
      )}

      {protocol.expected_timeline.length > 0 && (
        <Block title="What to expect, when">
          <Card padding="none">
            <ol className="divide-y divide-[var(--border)]">
              {protocol.expected_timeline.map((t) => (
                <li key={t.marker} className="flex gap-3 px-4 py-3">
                  <span className="w-[72px] shrink-0 text-footnote font-semibold tabular-nums">
                    {t.marker}
                  </span>
                  <div className="min-w-0">
                    <div className="text-footnote">{t.expect}</div>
                    {t.evidence && (
                      <div className="mt-1 text-caption text-[var(--muted)]">{t.evidence}</div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </Block>
      )}

      {protocol.items.length > 0 && (
        <Block title={`What's included (${protocol.items.length})`}>
          <div className="flex flex-col gap-5">
            {slots.map(({ slot, items }) => (
              <div key={slot}>
                <div className="mb-2 text-eyebrow uppercase text-[var(--muted)]">
                  {TIMING_LABELS[slot as TimingSlot] ?? slot}
                </div>
                <div className="flex flex-col gap-2">
                  {items.map((it) => (
                    <Card key={it.key} padding="md">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-callout font-semibold">{it.name}</div>
                          {(it.dose || it.brand) && (
                            <div className="text-caption text-[var(--muted)]">
                              {[it.dose, it.brand].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </div>
                        <Chip className="shrink-0">
                          {ITEM_TYPE_LABELS[it.item_type] ?? it.item_type}
                        </Chip>
                      </div>
                      <div className="mt-1.5 text-caption text-[var(--foreground-soft)]">
                        {it.starts_on_day != null && it.starts_on_day > 0
                          ? `Starts day ${it.starts_on_day}`
                          : "Starts right away"}
                        {it.ends_on_day != null ? ` · ends day ${it.ends_on_day}` : ""}
                      </div>
                      {it.usage_notes && (
                        <p className="mt-1.5 text-footnote text-[var(--foreground-soft)]">
                          {it.usage_notes}
                        </p>
                      )}
                      {it.research_summary && (
                        <p className="mt-2 border-t border-[var(--border)] pt-2 text-caption text-[var(--muted)]">
                          {it.research_summary}
                        </p>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Block>
      )}

      <Block title="Safety">
        <Card tone="warn" padding="md">
          <p className="text-footnote text-[var(--foreground-soft)]">{protocol.safety_notes}</p>
          {protocol.contraindications && protocol.contraindications.length > 0 && (
            <BulletList label="Not for you if" items={protocol.contraindications} />
          )}
        </Card>
      </Block>

      {protocol.research_summary && (
        <Block title="The research, briefly">
          <Card padding="md">
            <p className="text-footnote text-[var(--foreground-soft)]">
              {protocol.research_summary}
            </p>
          </Card>
        </Block>
      )}

      <Sheet
        open={stopOpen}
        onClose={() => setStopOpen(false)}
        title="Stop following?"
        description="Your logs and history stay either way."
      >
        <div className="flex flex-col gap-2 pb-2">
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            loading={unenrolling}
            onClick={() => unenroll(false)}
          >
            Stop, keep items on Today
          </Button>
          <Button
            variant="destructive"
            size="lg"
            fullWidth
            disabled={unenrolling}
            onClick={() => unenroll(true)}
          >
            Stop and retire its {protocol.items.length} items
          </Button>
        </div>
      </Sheet>

      <div className="mt-8 text-center">
        <Link
          href="/protocols"
          className="inline-flex min-h-[44px] items-center gap-1 text-footnote font-medium text-[var(--foreground-soft)]"
        >
          All protocols
          <Icon name="chevron-right" size={14} strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <SectionHeader title={title} />
      {children}
    </section>
  );
}

function BulletList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-3">
      <div className="text-caption font-semibold text-[var(--muted)]">{label}</div>
      <ul className="mt-1 flex list-disc flex-col gap-1 pl-4 text-caption text-[var(--foreground-soft)]">
        {items.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </div>
  );
}
