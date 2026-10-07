// /tests/[marker] — one biomarker over time: date-scaled chart with the
// reference band, item start dates pinned, history table, Coach handoff.

import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addDaysISO, daysBetween } from "@/lib/series";
import {
  biomarkerTrajectories,
  rangeStatus,
  relatedItemIds,
  type BiomarkerRow as BiomarkerDbRow,
} from "@/lib/insights/biomarkers";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import { SectionHeader } from "@/components/ui/Section";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import MetricDelta from "@/components/MetricDelta";
import LineChart from "@/components/charts/LineChart";
import RangeGauge from "@/components/insights/RangeGauge";
import AskCoach from "@/components/insights/AskCoach";
import {
  deltaDirection,
  fmtRange,
  fmtValue,
  statusChip,
} from "@/components/insights/BiomarkerRow";
import { fmtShortDate } from "@/components/insights/WorkingItemCard";
import { shortItemName } from "@/lib/insights/hub";

type ItemRow = {
  id: string;
  name: string;
  goals: string[] | null;
  started_on: string | null;
  status: string;
  item_type: string | null;
};

function fmtLong(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function MarkerPage({
  params,
}: {
  params: Promise<{ marker: string }>;
}) {
  const { marker: raw } = await params;
  const name = decodeURIComponent(raw);
  const supabase = await createClient();
  const [bioRes, itemsRes] = await Promise.all([
    supabase
      .from("biomarkers")
      .select("name, display_name, value, unit, reference_range, flag, drawn_on, panel, notes")
      .eq("name", name)
      .order("drawn_on"),
    supabase
      .from("items")
      .select("id, name, goals, started_on, status, item_type")
      .not("started_on", "is", null)
      .in("status", ["active", "retired"]),
  ]);
  const rows = (bioRes.data ?? []) as (BiomarkerDbRow & { notes?: string | null })[];
  const [t] = biomarkerTrajectories(rows);
  if (!t) notFound();

  const items = ((itemsRes.data ?? []) as ItemRow[]).filter((i) => i.item_type !== "test");
  const first = t.history[0].date;
  const last = t.latest.date;
  // Items that plausibly relate to this marker (by name / goal), started
  // in the 90 days before the first draw through the latest draw.
  const relatedIds = new Set(relatedItemIds(t.name, items));
  const windowFrom = addDaysISO(first, -90);
  const inWindow = items.filter(
    (i) => i.started_on! >= windowFrom && i.started_on! <= last,
  );
  const related = inWindow.filter((i) => relatedIds.has(i.id));
  const between = t.history.length > 1
    ? items.filter((i) => i.started_on! > first && i.started_on! <= last)
    : [];
  const pinned = (related.length ? related : between)
    .filter((i) => i.started_on! > first && i.started_on! < last)
    .sort((a, b) => (a.started_on! < b.started_on! ? -1 : 1))
    .slice(0, 2);

  const chip = statusChip(t);
  const range = fmtRange(t);
  const unit = t.unit ?? undefined;
  const tone =
    t.status === "out" ? "var(--error)" : t.status === "near" ? "var(--warn)" : "var(--foreground)";
  const notes = rows.filter((r) => r.notes).slice(-1)[0]?.notes ?? null;

  const historyText = t.history
    .map((h) => `${fmtLong(h.date)}: ${fmtValue(h.value)}${unit ? ` ${unit}` : ""}`)
    .join("; ");
  const startedText = (related.length ? related : between)
    .map((i) => `${i.name} (started ${fmtLong(i.started_on!)})`)
    .join(", ");
  const prompt =
    `Help me understand my ${t.displayName} results. History: ${historyText}. ` +
    `Reference range: ${range ?? "unknown"}${unit ? ` ${unit}` : ""}. Latest is ${chip?.label.toLowerCase() ?? "unclassified"}. ` +
    (startedText ? `Items I started around these draws: ${startedText}. ` : "") +
    `What could explain the change, does anything in my stack plausibly affect it, what should I do next, and when should I retest? ` +
    `Be honest about what ${t.history.length} data point${t.history.length === 1 ? "" : "s"} can and can't tell us.`;

  return (
    <div className="pb-24">
      <PageHeader
        back="/tests"
        backLabel="Labs"
        eyebrow={t.panel ?? "Biomarker"}
        title={t.displayName}
        subtitle={`${t.history.length} draw${t.history.length === 1 ? "" : "s"} · ${fmtShortDate(first)}${t.history.length > 1 ? ` – ${fmtShortDate(last)}` : ""}`}
      />

      <Card padding="lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-eyebrow uppercase text-[var(--muted)]">
              Latest · {fmtShortDate(last)}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5 tabular-nums">
              <span className="text-[40px] leading-[44px] font-bold tracking-[-0.02em]" style={{ color: tone }}>
                {fmtValue(t.latest.value)}
              </span>
              {unit && <span className="text-footnote text-[var(--muted)]">{unit}</span>}
            </div>
            {t.previous && t.delta != null && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-caption text-[var(--muted)]">
                <MetricDelta
                  delta={Number(fmtValue(t.delta))}
                  direction={deltaDirection(t)}
                  unit={unit ? ` ${unit}` : undefined}
                  hideOnZero={false}
                />
                <span>
                  vs {fmtShortDate(t.previous.date)}
                  {t.pctChange != null ? ` (${t.pctChange > 0 ? "+" : "−"}${Math.abs(t.pctChange).toFixed(0)}%)` : ""}
                  {t.change === "better" ? " · moved the right way" : t.change === "worse" ? " · moved the wrong way" : t.change === "same" ? " · about the same" : ""}
                </span>
              </div>
            )}
          </div>
          {chip && (
            <Chip tone={chip.tone} size="sm" className="mt-1 shrink-0">
              {chip.label}
            </Chip>
          )}
        </div>
        {(t.range.lo != null || t.range.hi != null) && (
          <div className="mt-5">
            <RangeGauge
              range={t.range}
              value={t.latest.value}
              previous={t.previous?.value ?? null}
              unit={unit}
              tone={tone}
            />
            <p className="mt-1 text-caption text-[var(--muted)]">
              Reference {range}
              {unit ? ` ${unit}` : ""}
              {t.previous ? " · hollow dot = previous draw" : ""}
            </p>
          </div>
        )}
      </Card>

      <SectionHeader title="Over time" />
      <Card padding="md">
        <LineChart
          points={t.history.map((h) => ({ x: h.date, y: h.value }))}
          band={
            t.range.lo != null || t.range.hi != null
              ? { lo: t.range.lo, hi: t.range.hi, label: "Reference" }
              : undefined
          }
          markers={pinned.map((i) => ({ x: i.started_on!, label: `Started ${shortItemName(i.name)}` }))}
          outOfRangeTone
          unit={unit}
          height={180}
          minPoints={2}
          ariaLabel={`${t.displayName} over time`}
        />
        <p className="mt-2 text-caption text-[var(--muted)]">
          {t.history.length < 2
            ? "One draw so far — retest to see a trend."
            : `Dates to scale · ${daysBetween(first, last)} days between first and latest draw.`}
          {pinned.length > 0 ? " Dashed lines mark when items started — timing only, not proof of effect." : ""}
        </p>
      </Card>

      <SectionHeader title="History" />
      <Card padding="none">
        <table className="w-full text-footnote tabular-nums">
          <thead>
            <tr className="text-left text-caption text-[var(--muted)]">
              <th className="px-4 py-2.5 font-medium">Drawn</th>
              <th className="px-2 py-2.5 text-right font-medium">Value</th>
              <th className="px-2 py-2.5 text-right font-medium">Change</th>
              <th className="px-4 py-2.5 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {[...t.history].reverse().map((h, i, arr) => {
              const prev = arr[i + 1];
              const d = prev ? h.value - prev.value : null;
              const st = rangeStatus(h.value, t.range);
              const c = statusChip(st);
              return (
                <tr key={h.date} className="border-t border-[var(--border)]">
                  <td className="whitespace-nowrap px-4 py-3">{fmtLong(h.date)}</td>
                  <td className="px-2 py-3 text-right font-semibold">
                    {fmtValue(h.value)}
                    {unit && <span className="ml-1 text-caption font-normal text-[var(--muted)]">{unit}</span>}
                  </td>
                  <td className="px-2 py-3 text-right text-[var(--foreground-soft)]">
                    {d == null ? "—" : `${d > 0 ? "+" : d < 0 ? "−" : ""}${fmtValue(Math.abs(d))}`}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c ? <Chip size="sm" tone={c.tone}>{c.label}</Chip> : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      {notes && <p className="mt-2 px-1 text-caption text-[var(--muted)]">Note: {notes}</p>}

      {(related.length > 0 || between.length > 0) && (
        <>
          <SectionHeader
            title={related.length ? "Possibly related items" : "Started between draws"}
            eyebrow={related.length ? "By name or goal" : undefined}
          />
          <ListGroup>
            {(related.length ? related : between).slice(0, 6).map((i) => (
              <ListRow
                key={i.id}
                href={`/items/${i.id}`}
                title={i.name}
                subtitle={`Started ${fmtShortDate(i.started_on!)}${i.started_on! > first && i.started_on! <= last ? " · between draws" : ""}`}
              />
            ))}
          </ListGroup>
          <p className="mt-2 px-1 text-caption text-[var(--muted)]">
            Timing lines up — that&apos;s association, not proof.
          </p>
        </>
      )}

      <div className="mt-6">
        <AskCoach prompt={prompt} fullWidth />
      </div>
      <p className="mt-3 text-center text-caption text-[var(--muted)]">
        <Link href="/tests" className="inline-flex min-h-[44px] items-center">
          All markers
        </Link>
      </p>
    </div>
  );
}
