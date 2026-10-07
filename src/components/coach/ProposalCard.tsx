"use client";

// One-tap change card for a Coach proposal. Approve = white primary
// (retire = destructive); dismiss = secondary. For add/queue, previews
// whether the item would push any ingredient toward its upper limit.

import { useEffect, useState } from "react";
import type { Proposal } from "@/lib/proposals";
import Icon from "@/components/Icon";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import type { ExecState } from "./types";

const TIMING_LABELS: Record<string, string> = {
  pre_breakfast: "first thing in the morning",
  breakfast: "with breakfast",
  pre_workout: "before your workout",
  lunch: "with lunch",
  dinner: "with dinner",
  pre_bed: "before bed",
  ongoing: "throughout the day",
  situational: "as needed",
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Every day",
  weekly: "Weekly",
  monthly: "Monthly",
  cycled_5_2: "Cycled (5 days on, 2 off)",
  cycled_8_4: "Cycled (8 weeks on, 4 off)",
};

const CATEGORY_LABELS: Record<string, string> = {
  permanent: "your permanent stack",
  temporary: "temporary — review later",
  cycled: "cycled — on/off rotation",
  situational: "as needed",
  condition_linked: "tied to a condition",
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Technical proposal extras → short human sentences. */
function humanizeExtra(key: string, value: string): string | null {
  switch (key) {
    case "timing_slot":
      return `Take ${TIMING_LABELS[value] ?? `at ${value.replace(/_/g, " ")}`}`;
    case "frequency":
      return FREQUENCY_LABELS[value] ?? cap(value.replace(/_/g, " "));
    case "category":
      return `In ${CATEGORY_LABELS[value] ?? value.replace(/_/g, " ")}`;
    case "dose":
      return `Dose: ${value}`;
    case "brand":
      return `Brand: ${value}`;
    case "goals": {
      const list = value
        .split(/[,;]/)
        .map((g) => g.trim())
        .filter(Boolean);
      if (list.length === 0) return null;
      return `For ${list.join(" · ")}`;
    }
    case "item_type":
    case "catalog_item_id":
      return null;
    case "notes":
      return value.length > 80 ? value.slice(0, 77) + "…" : value;
    case "companion_of":
      return `Pair with ${value}`;
    case "companion_instruction":
      return value;
    default:
      return cap(`${key.replace(/_/g, " ")}: ${value}`);
  }
}

const ACTION_META: Record<
  Proposal["action"],
  { headline: string; yes: string; no: string; destructive?: boolean }
> = {
  add: { headline: "Add to your stack?", yes: "Yes, add it", no: "Not now" },
  update: { headline: "Update this item?", yes: "Yes, update", no: "Leave it" },
  adjust: { headline: "Adjust this?", yes: "Yes, adjust", no: "Leave it" },
  retire: { headline: "Drop from your stack?", yes: "Yes, drop it", no: "Keep it", destructive: true },
  promote: { headline: "Move to active?", yes: "Yes, activate", no: "Not now" },
  queue: { headline: "Queue for later?", yes: "Yes, queue", no: "Not now" },
};

type PreviewWarning = {
  ingredient_key: string;
  label: string;
  unit: "mg" | "mcg";
  total_amount: number;
  ul: number;
  ratio: number;
  severity: "info" | "warning" | "critical";
};
type PreviewResponse = {
  matched: boolean;
  candidate: { id: string; name: string } | null;
  added: PreviewWarning[];
};

export default function ProposalCard({
  proposal,
  state,
  onApprove,
  onDismiss,
}: {
  proposal: Proposal;
  state?: ExecState;
  onApprove: (p: Proposal) => void;
  onDismiss: (p: Proposal) => void;
}) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const isAdd = proposal.action === "add" || proposal.action === "queue";
  useEffect(() => {
    if (!isAdd) return;
    const catalogId = proposal.extra?.catalog_item_id;
    const params = new URLSearchParams();
    if (catalogId) params.set("catalog_item_id", catalogId);
    else params.set("name", proposal.item_name);
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/ingredient-stack/preview?${params.toString()}`, {
          credentials: "include",
        });
        if (!r.ok) return;
        const j = (await r.json()) as PreviewResponse;
        if (alive) setPreview(j);
      } catch {
        // silent — preview is non-blocking
      }
    })();
    return () => {
      alive = false;
    };
  }, [isAdd, proposal.extra?.catalog_item_id, proposal.item_name]);

  const meta = ACTION_META[proposal.action] ?? ACTION_META.update;
  const extras = proposal.extra
    ? Object.entries(proposal.extra)
        .map(([k, v]) => humanizeExtra(k, v))
        .filter((s): s is string => s !== null)
    : [];

  // After approval or dismissal the card leaves the thread entirely —
  // the toast + items-changed refresh are the confirmation.
  if (state === "done" || state === "error") return null;

  const warnings = preview?.added ?? [];
  const serious = warnings.some((w) => w.severity !== "info");

  return (
    <Card padding="md" className="w-full">
      <div
        className={`text-eyebrow uppercase ${meta.destructive ? "text-[var(--error)]" : "text-[var(--muted)]"}`}
      >
        {meta.headline}
      </div>
      <div className="mt-1 text-title-3">{proposal.item_name}</div>
      {proposal.reasoning && (
        <p className="mt-1.5 text-callout text-[var(--foreground-soft)]">{proposal.reasoning}</p>
      )}
      {extras.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 border-t border-[var(--border)] pt-3">
          {extras.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-footnote text-[var(--foreground-soft)]">
              <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--muted)]" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && (
        <div
          className={`mt-3 rounded-[14px] border p-3 ${
            serious
              ? "border-[rgba(242,107,126,0.24)] bg-[var(--error-tint)]"
              : "border-[rgba(232,181,71,0.24)] bg-[var(--warn-tint)]"
          }`}
        >
          <div
            className={`flex items-center gap-1.5 text-eyebrow uppercase ${serious ? "text-[var(--error)]" : "text-[var(--warn)]"}`}
          >
            <Icon name="alert" size={13} strokeWidth={2} />
            Stack impact
          </div>
          {warnings.slice(0, 2).map((w) => (
            <p key={w.ingredient_key} className="mt-1 text-footnote text-[var(--foreground-soft)]">
              <strong className="font-semibold text-[var(--foreground)]">{w.label}</strong> would
              reach {w.total_amount} {w.unit} — {Math.round(w.ratio * 100)}% of the {w.ul} {w.unit}{" "}
              upper limit.
            </p>
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Button
          variant={meta.destructive ? "destructive" : "primary"}
          icon="check"
          loading={state === "pending"}
          onClick={() => onApprove(proposal)}
          className="flex-1"
        >
          {meta.yes}
        </Button>
        <Button variant="secondary" onClick={() => onDismiss(proposal)}>
          {meta.no}
        </Button>
      </div>
    </Card>
  );
}
