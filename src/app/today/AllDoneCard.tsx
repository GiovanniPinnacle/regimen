// Calm end-of-day state: today's numbers and when tomorrow starts.

import Icon from "@/components/Icon";
import { TIMING_LABELS } from "@/lib/constants";
import type { TimingSlot } from "@/lib/types";

function hourLabel(h: number) {
  const suffix = h >= 12 ? "pm" : "am";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${suffix}`;
}

export default function AllDoneCard({
  taken,
  skipped,
  streak,
  avg14,
  tomorrow,
}: {
  taken: number;
  skipped: number;
  streak: number | null;
  /** 14-day average adherence, 0-100. */
  avg14: number | null;
  tomorrow: { slot: TimingSlot; hour: number; count: number } | null;
}) {
  const stats: { label: string; value: string }[] = [
    { label: "Taken", value: String(taken) },
  ];
  if (skipped > 0) stats.push({ label: "Skipped", value: String(skipped) });
  if (streak != null && streak > 0)
    stats.push({ label: "Streak", value: `${streak}d` });
  if (avg14 != null) stats.push({ label: "14-day avg", value: `${avg14}%` });

  return (
    <section
      aria-label="All done for today"
      className="mt-3 rounded-[20px] border border-[rgba(52,194,142,0.24)] bg-[var(--success-tint)] p-4"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--success)] text-[var(--success-fg)]">
          <Icon name="check" size={18} strokeWidth={2.6} />
        </span>
        <div className="min-w-0">
          <h2 className="text-title-3">All done for today</h2>
          {tomorrow && (
            <p className="text-footnote text-[var(--foreground-soft)]">
              Tomorrow starts with {TIMING_LABELS[tomorrow.slot]} at{" "}
              {hourLabel(tomorrow.hour)} · {tomorrow.count} item
              {tomorrow.count === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </div>
      <dl
        className="mt-4 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
      >
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <dt className="truncate text-caption text-[var(--foreground-soft)]">
              {s.label}
            </dt>
            <dd className="text-title-3 tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
