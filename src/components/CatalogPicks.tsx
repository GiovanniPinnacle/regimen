"use client";

// CatalogPicks — proactive "Coach picks for you" card on /today.
//
// Surfaces high-evidence catalog entries the user doesn't have in their
// stack yet. Different from SmartSuggestions (pair/topping/consolidate
// for existing items) — this surface is *additions*, grounded in our
// enriched catalog so every pick has mechanism + timing + evidence
// grade attached.
//
// UX: one pick at a time, three actions:
//   - Queue it       → proposal pipeline, action: queue (catalog_item_id passed)
//   - Tell me why    → opens Coach with a focused prompt about THIS pick
//   - Not for me     → 30-day per-catalog-id mute (localStorage)
//
// Hidden when no picks available, the user has dismissed all of them,
// or the user is in first_visit / stack_built stages (they should build
// before adding more).

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { CoachNoteCard } from "@/components/CoachCardStack";
import { openCoach } from "@/lib/coach-events";
import SwipeDismiss from "@/components/SwipeDismiss";
import { usePulseCount } from "@/components/CoachPulse";
import StepIndicator from "@/components/StepIndicator";

type Pick = {
  catalog_item_id: string;
  name: string;
  brand: string | null;
  item_type: string;
  category: string | null;
  evidence_grade: string | null;
  coach_summary: string | null;
  best_timing: string | null;
  mechanism: string | null;
};

const DISMISS_KEY_PREFIX = "regimen.catalog_pick.dismissed.v1.";
const DISMISS_TTL_MS = 30 * 86400000;

/** Read the set of catalog_item_ids the user has dismissed within the
 *  TTL window. Pure read of localStorage — safe to call in an effect or
 *  event handler, never during render. */
function readDismissedIds(picks: Pick[]): Set<string> {
  if (typeof window === "undefined") return new Set();
  const now = Date.now();
  const out = new Set<string>();
  for (const p of picks) {
    try {
      const raw = localStorage.getItem(
        `${DISMISS_KEY_PREFIX}${p.catalog_item_id}`,
      );
      if (!raw) continue;
      const ts = parseInt(raw, 10);
      if (!Number.isNaN(ts) && now - ts < DISMISS_TTL_MS) {
        out.add(p.catalog_item_id);
      }
    } catch {}
  }
  return out;
}

export default function CatalogPicks() {
  /** Visible picks — already pre-filtered against the dismiss-ttl
   *  localStorage set when fetched. We store the filtered list directly
   *  so the render path stays pure (no Date.now() reads, no localStorage
   *  reads during render, no setState in an effect). */
  const [picks, setPicks] = useState<Pick[] | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/coach/catalog-picks", {
          credentials: "include",
        });
        if (!r.ok) return;
        const j = (await r.json()) as { picks?: Pick[] };
        const all = j.picks ?? [];
        const dismissed = readDismissedIds(all);
        const filtered = all.filter(
          (p) => !dismissed.has(p.catalog_item_id),
        );
        if (alive) setPicks(filtered);
      } catch {
        // silent
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const visible = picks && picks.length > 0 ? picks[0] : null;

  function dismiss(p: Pick) {
    try {
      localStorage.setItem(
        `${DISMISS_KEY_PREFIX}${p.catalog_item_id}`,
        String(Date.now()),
      );
    } catch {}
    setPicks((prev) =>
      prev ? prev.filter((x) => x.catalog_item_id !== p.catalog_item_id) : prev,
    );
  }

  function queueIt(p: Pick) {
    setPendingId(p.catalog_item_id);
    const prompt = [
      `Queue "${p.name}"${p.brand ? ` (${p.brand})` : ""} for me.`,
      `It's a Grade ${p.evidence_grade ?? "B"} ${p.item_type} from our catalog (catalog_item_id: ${p.catalog_item_id}).`,
      `Emit ONE proposal in <<<PROPOSAL ... PROPOSAL>>> format with action: queue, item_name: ${p.name}, item_type: ${p.item_type}, and include catalog_item_id: ${p.catalog_item_id} in extras so the user item links to the shared catalog row.`,
      p.best_timing ? `Recommended timing: ${p.best_timing}` : "",
      p.brand ? `Brand: ${p.brand}` : "",
      `Keep your reasoning to one sentence in the proposal — the user already saw the summary.`,
    ]
      .filter(Boolean)
      .join("\n\n");
    openCoach({ text: prompt, send: true });
    // After firing, dismiss locally so this pick doesn't re-render
    dismiss(p);
    setPendingId(null);
  }

  function tellMeWhy(p: Pick) {
    // Pre-fill the prompt but DON'T auto-send. The user opens Coach,
    // sees the question already typed, and can append their own
    // context (e.g. "but I have seb derm — does that matter?") before
    // tapping send. Closes the "doesn't let me tell more" gap.
    const prompt = `Should I add "${p.name}"${p.brand ? ` (${p.brand})` : ""} to my stack? Give me the case for AND against, given my goals + what I already take.`;
    openCoach({ text: prompt });
  }

  usePulseCount("picks", visible ? 1 : 0);
  if (picks === null) return null; // loading
  if (!visible) return null; // nothing to show

  const grade = visible.evidence_grade ?? "B";
  // First sentence of the summary keeps the card scannable; "Why
  // this?" opens the full case in Coach.
  const summary = visible.coach_summary?.match(/^[^.!?]+[.!?]/)?.[0] ?? visible.coach_summary;
  const body = [
    summary,
    visible.best_timing ? `Best taken: ${visible.best_timing}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <section className="mb-4">
      <SwipeDismiss onDismiss={() => dismiss(visible)}>
        <CoachNoteCard
          icon="plus"
          tone="coach"
          eyebrow={`Worth adding · Grade ${grade}`}
          meta={<StepIndicator current={0} total={picks.length} />}
          title={
            <>
              {visible.name}
              {visible.brand ? (
                <span className="font-normal text-[var(--muted)]">
                  {" "}
                  · {visible.brand}
                </span>
              ) : null}
            </>
          }
          body={body || undefined}
          onDismiss={() => dismiss(visible)}
          dismissLabel="Not for me"
          actions={
            <>
              <Button
                size="md"
                variant="primary"
                onClick={() => queueIt(visible)}
                loading={pendingId === visible.catalog_item_id}
              >
                Queue it
              </Button>
              <Button size="md" variant="secondary" onClick={() => tellMeWhy(visible)}>
                Why this?
              </Button>
            </>
          }
        />
      </SwipeDismiss>
    </section>
  );
}
