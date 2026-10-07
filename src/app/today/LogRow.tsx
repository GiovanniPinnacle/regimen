"use client";

// Compact "Log something" row: water / meal / symptom open the universal
// capture sheet pre-tagged with a hint. Below it, a one-line intake
// summary that links to Fuel (where the full tracker lives).

import Link from "next/link";
import Icon, { type IconName } from "@/components/Icon";
import { Eyebrow } from "@/components/ui/Section";
import type { TodayIntake } from "./useTodayData";

const ACTIONS: { hint: string; label: string; icon: IconName }[] = [
  { hint: "water", label: "Water", icon: "droplet" },
  { hint: "meal", label: "Meal", icon: "utensils" },
  { hint: "symptom", label: "How I feel", icon: "heart" },
];

function capture(hint: string) {
  window.dispatchEvent(new CustomEvent("regimen:capture", { detail: { hint } }));
}

export default function LogRow({
  intake,
  waterTargetOz,
  proteinTargetG,
}: {
  intake: TodayIntake;
  waterTargetOz: number | null;
  proteinTargetG: number | null;
}) {
  const parts: string[] = [];
  if (intake) {
    parts.push(
      `${intake.waterOz}${waterTargetOz ? ` / ${waterTargetOz}` : ""} oz water`,
    );
    parts.push(
      `${intake.proteinG}${proteinTargetG ? ` / ${proteinTargetG}` : ""} g protein`,
    );
  }

  return (
    <section aria-label="Log something" className="mt-8">
      <Eyebrow className="mb-2 px-1">Log something</Eyebrow>
      <div className="grid grid-cols-3 gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.hint}
            type="button"
            onClick={() => capture(a.hint)}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-2 text-callout font-medium text-[var(--foreground)] active:bg-[var(--surface-alt)]"
          >
            <Icon
              name={a.icon}
              size={17}
              strokeWidth={1.8}
              className="shrink-0 text-[var(--foreground-soft)]"
            />
            {a.label}
          </button>
        ))}
      </div>
      {parts.length > 0 && (
        <Link
          href="/fuel"
          className="mt-1 flex min-h-[44px] items-center justify-between gap-2 px-1 text-footnote text-[var(--muted)]"
        >
          <span className="truncate tabular-nums">
            Today: {parts.join(" · ")}
          </span>
          <span className="flex shrink-0 items-center gap-0.5 font-medium text-[var(--foreground-soft)]">
            Fuel
            <Icon name="chevron-right" size={14} strokeWidth={2} />
          </span>
        </Link>
      )}
    </section>
  );
}
