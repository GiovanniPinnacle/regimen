"use client";

// ProtocolSheet — pick a day-by-day protocol without leaving onboarding.
// Protocols matching the user's focus are listed first.

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import {
  listProtocols,
  isProtocolEnrollable,
  formatDuration,
  protocolIcon,
} from "@/lib/protocols";
import { getEnrollments } from "@/lib/storage";
import type { Protocol } from "@/lib/types";

function matchesFocus(p: Protocol, focus: readonly string[]): boolean {
  return focus.some(
    (f) => p.category === f || (p.tags ?? []).includes(f),
  );
}

export default function ProtocolSheet({
  open,
  onClose,
  focus,
  postopDate,
  onEnrolled,
}: {
  open: boolean;
  onClose: () => void;
  focus: readonly string[];
  postopDate: string | null;
  onEnrolled: (slug: string) => void;
}) {
  const protocols = useMemo(() => {
    const list = listProtocols().filter(isProtocolEnrollable);
    return [
      ...list.filter((p) => matchesFocus(p, focus)),
      ...list.filter((p) => !matchesFocus(p, focus)),
    ];
  }, [focus]);

  const [enrolled, setEnrolled] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    getEnrollments()
      .then((list) => {
        if (!alive) return;
        setEnrolled(
          new Set(
            list.filter((e) => e.status === "active").map((e) => e.protocol_slug),
          ),
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open]);

  async function enroll(p: Protocol) {
    setBusy(p.slug);
    setErr(null);
    try {
      // Recovery protocols count from the procedure date when we have one.
      const start_date =
        p.category === "recovery" && postopDate ? postopDate : undefined;
      const res = await fetch("/api/protocols/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: p.slug, start_date }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't start that protocol.");
      setEnrolled((s) => new Set(s).add(p.slug));
      window.dispatchEvent(new CustomEvent("regimen:items-changed"));
      onEnrolled(p.slug);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Follow a protocol"
      description="Day-by-day plans. Items appear on Today as each day arrives."
    >
      <ul className="flex flex-col gap-2">
        {protocols.map((p) => {
          const on = enrolled.has(p.slug);
          return (
            <li
              key={p.slug}
              className="flex items-start gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--surface-alt)] p-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--surface)] text-[var(--foreground-soft)]">
                <Icon name={protocolIcon(p)} size={20} strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-callout font-semibold">{p.name}</div>
                <p className="mt-0.5 line-clamp-2 text-caption text-[var(--muted)]">
                  {p.tagline}
                </p>
                <div className="mt-1 text-caption text-[var(--muted)]">
                  {formatDuration(p.duration_days)} · {p.items.length} items
                </div>
              </div>
              <div className="shrink-0 self-center">
                {on ? (
                  <Chip tone="success" icon="check">
                    Following
                  </Chip>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busy === p.slug}
                    disabled={busy !== null}
                    onClick={() => enroll(p)}
                    className="min-h-[44px]"
                  >
                    Start
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {err && (
        <p className="mt-3 text-caption text-[var(--error)]" role="alert">
          {err}
        </p>
      )}
    </Sheet>
  );
}
