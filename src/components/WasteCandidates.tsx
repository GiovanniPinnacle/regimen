"use client";

// WasteCandidates — what you pay for but don't take. Waste per month =
// monthly cost × (1 − adherence), adherence measured against scheduled
// doses over the last 30 days. Tapping a row hands the decision to
// Coach (drop vs. make it stick) rather than retiring anything directly.

import Icon from "@/components/Icon";
import { formatUSD } from "@/lib/cost";
import { openCoach } from "@/lib/coach-events";

type Candidate = {
  item_id: string;
  item_name: string;
  monthly_cost: number;
  adherence_rate: number;
  taken_count: number;
  total_count: number;
  annualized_waste: number;
};

export default function WasteCandidates({
  candidates,
}: {
  candidates: Candidate[];
}) {
  if (candidates.length === 0) return null;

  function ask(c: Candidate) {
    openCoach({
      text: `I've taken ${c.item_name} ${c.taken_count} of ${c.total_count} scheduled times in the last 30 days (${Math.round(c.adherence_rate * 100)}%) and it costs ${formatUSD(c.monthly_cost)}/month — about ${formatUSD(c.annualized_waste)}/year unused. Should I drop it, or is there a small change (timing, dose, form, pairing) that would make it stick? Look at my skip reasons. Emit ONE proposal in <<<PROPOSAL ... PROPOSAL>>> format with action: retire OR action: adjust, with one sentence of reasoning.`,
      send: true,
    });
  }

  return (
    <div className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
      {candidates.map((c) => {
        const monthlyWaste = c.monthly_cost * (1 - c.adherence_rate);
        return (
          <button
            key={c.item_id}
            type="button"
            onClick={() => ask(c)}
            className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-[var(--surface-alt)]"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-callout font-semibold">{c.item_name}</span>
              <span className="block text-caption tabular-nums text-[var(--muted)]">
                Taken {Math.round(c.adherence_rate * 100)}% ({c.taken_count}/{c.total_count}) ·{" "}
                {formatUSD(c.monthly_cost)}/mo
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-callout font-bold tabular-nums">
                {formatUSD(monthlyWaste)}
              </span>
              <span className="block text-caption text-[var(--muted)]">unused/mo</span>
            </span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--pro-tint)] text-[var(--pro-soft)]">
              <Icon name="sparkle" size={15} strokeWidth={1.8} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
