"use client";

// Today hero: one ring (taken / due), the streak, one honest pace chip,
// and the Oura row with deltas vs the user's own 30-day baseline.

import Link from "next/link";
import MetricRing from "@/components/MetricRing";
import MetricDelta from "@/components/MetricDelta";
import Icon from "@/components/Icon";
import Chip from "@/components/ui/Chip";
import type { OuraMetric } from "./model";

export type Pace = {
  /** Today's share of scheduled doses done so far (0-100). */
  todayPct: number;
  /** Usual share done by this time of day (0-100). */
  usualPct: number;
  days: number;
};

function PaceChip({ pace }: { pace: Pace }) {
  const diff = pace.todayPct - pace.usualPct;
  if (diff >= -5) {
    return (
      <Chip tone="success" icon="check">
        {diff >= 10 ? "Ahead of your usual pace" : "On your usual pace"}
      </Chip>
    );
  }
  return (
    <Chip tone="neutral" icon="clock">
      Usually {pace.usualPct}% by now
    </Chip>
  );
}

export default function TodayHero({
  taken,
  total,
  streak,
  pace,
  oura,
}: {
  taken: number;
  total: number;
  streak: number | null;
  pace: Pace | null;
  oura: OuraMetric[];
}) {
  const pct = total > 0 ? Math.round((taken / total) * 100) : 0;
  const complete = total > 0 && taken >= total;
  const left = Math.max(0, total - taken);

  return (
    <section
      aria-label="Today at a glance"
      className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)]"
    >
      <div className="flex items-center gap-4 p-4">
        <MetricRing
          value={taken}
          max={Math.max(1, total)}
          size={84}
          strokeWidth={8}
          color={complete ? "var(--success)" : "var(--foreground)"}
          trackColor="var(--surface-alt)"
          ariaLabel={`${taken} of ${total} done, ${pct}%`}
        >
          <span className="text-title-2 leading-none tabular-nums">
            {taken}
          </span>
          <span className="mt-0.5 text-caption leading-none text-[var(--muted)] tabular-nums">
            of {total}
          </span>
        </MetricRing>
        <div className="min-w-0 flex-1">
          <div className="text-title-3">
            {complete
              ? "All done"
              : taken === 0
                ? `${total} to go`
                : `${left} left`}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-footnote text-[var(--foreground-soft)]">
            {streak != null && streak > 0 ? (
              <>
                <Icon name="flame" size={14} strokeWidth={1.8} />
                <span className="tabular-nums">
                  {streak}-day streak
                </span>
              </>
            ) : (
              <span>{pct}% of today</span>
            )}
          </div>
          {pace && !complete && (
            <div className="mt-2">
              <PaceChip pace={pace} />
            </div>
          )}
        </div>
      </div>

      {oura.length > 0 && (
        <Link
          href="/insights"
          aria-label="Oura today vs your 30-day average. Open Insights"
          className="block border-t border-[var(--border)] px-2 pt-2.5 pb-2 active:bg-[var(--surface-alt)] transition-colors"
        >
          <div className="flex items-center justify-between px-2">
            <span className="text-caption text-[var(--muted)]">
              Oura · vs your 30-day average
            </span>
            <Icon
              name="chevron-right"
              size={14}
              strokeWidth={2}
              className="text-[var(--muted)]"
            />
          </div>
          <div className="mt-1.5 grid grid-cols-4">
            {oura.map((m) => (
              <div key={m.key} className="min-w-0 px-1 py-1 text-center">
                <div className="truncate text-caption text-[var(--foreground-soft)]">
                  {m.label}
                </div>
                <div className="mt-0.5 text-title-3 tabular-nums">
                  {m.value}
                </div>
                <div className="mt-1 flex h-[18px] items-center justify-center">
                  {m.delta != null && m.delta !== 0 ? (
                    <MetricDelta
                      delta={m.delta}
                      direction={m.direction}
                      iconSize={10}
                    />
                  ) : (
                    <span className="text-caption text-[var(--muted)]">
                      {m.delta === 0 ? "at avg" : "—"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Link>
      )}
    </section>
  );
}
