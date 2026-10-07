// /tests — Labs. Biomarkers grouped by range status (out of range
// first), each with trend, reference range and range-aware change vs
// the previous draw. Scheduled tests (items of type "test") below.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { daysBetween } from "@/lib/series";
import {
  biomarkerTrajectories,
  type BiomarkerRow as BiomarkerDbRow,
  type BiomarkerTrajectory,
  type RangeStatus,
} from "@/lib/insights/biomarkers";
import { fetchAllRows } from "@/lib/insights/load";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { SectionHeader, Stat } from "@/components/ui/Section";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import { ButtonLink } from "@/components/ui/Button";
import BloodworkSection from "@/components/BloodworkSection";
import BiomarkerRow, { markerHref } from "@/components/insights/BiomarkerRow";
import { fmtShortDate } from "@/components/insights/WorkingItemCard";

export const dynamic = "force-dynamic";

type TestItem = {
  id: string;
  name: string;
  brand: string | null;
  status: string;
  review_trigger: string | null;
};

const GROUPS: { status: RangeStatus; title: string; eyebrow: string }[] = [
  { status: "out", title: "Out of range", eyebrow: "Needs attention" },
  { status: "near", title: "Borderline", eyebrow: "Inside range, close to the edge" },
  { status: "in", title: "In range", eyebrow: "Comfortably inside" },
  { status: "unknown", title: "No reference range", eyebrow: "Couldn't read a range" },
];

const TEST_STATUS: Record<string, string> = {
  queued: "Queued",
  active: "Scheduled",
  backburner: "Backburner",
  retired: "Done",
};

export default async function TestsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const marker = typeof sp.marker === "string" ? sp.marker : null;
  if (marker) redirect(markerHref(marker)); // legacy ?marker= links

  const supabase = await createClient();
  const [rows, testsRes] = await Promise.all([
    fetchAllRows<BiomarkerDbRow>(
      (a, b) =>
        supabase
          .from("biomarkers")
          .select("name, display_name, value, unit, reference_range, flag, drawn_on, panel")
          .order("drawn_on", { ascending: false })
          .order("name")
          .range(a, b),
      "biomarkers",
    ),
    supabase
      .from("items")
      .select("id, name, brand, status, review_trigger")
      .eq("item_type", "test")
      .order("status")
      .order("name"),
  ]);
  const tests = (testsRes.data ?? []) as TestItem[];
  const markers = biomarkerTrajectories(rows);

  const drawDates = [...new Set(rows.map((r) => r.drawn_on.slice(0, 10)))].sort();
  const latestDraw = drawDates[drawDates.length - 1] ?? null;
  const prevDraw = drawDates.length > 1 ? drawDates[drawDates.length - 2] : null;
  const onLatest = markers.filter((m) => m.latest.date === latestDraw);
  const outCount = markers.filter((m) => m.status === "out").length;
  const compared = markers.filter((m) => m.change != null && m.change !== "same");
  const better = compared.filter((m) => m.change === "better").length;
  const worse = compared.filter((m) => m.change === "worse").length;

  const byStatus = new Map<RangeStatus, BiomarkerTrajectory[]>();
  for (const m of markers) {
    if (!byStatus.has(m.status)) byStatus.set(m.status, []);
    byStatus.get(m.status)!.push(m);
  }

  return (
    <div className="pb-24">
      <PageHeader
        back="/you"
        backLabel="You"
        eyebrow="Bloodwork"
        title="Labs"
        subtitle={
          latestDraw
            ? `${markers.length} markers · ${drawDates.length} draw${drawDates.length === 1 ? "" : "s"} · latest ${fmtShortDate(latestDraw)}`
            : "Upload a panel to track markers against their reference range."
        }
      />

      {markers.length > 0 && latestDraw && (
        <Card padding="lg" className="mb-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Flagged" value={outCount} sub={`out of range, of ${markers.length}`} />
            <Stat
              label="Improved"
              value={prevDraw ? better : "—"}
              sub={prevDraw ? `${worse} worse` : "1 draw so far"}
            />
            <Stat
              label="Latest"
              value={fmtShortDate(latestDraw).split(" ")[1]}
              unit={fmtShortDate(latestDraw).split(" ")[0]}
              sub={`${onLatest.length} markers`}
            />
          </div>
          {prevDraw && (
            <p className="mt-3 border-t border-[var(--border)] pt-3 text-caption text-[var(--muted)]">
              Change vs the previous draw ({fmtShortDate(prevDraw)}, {daysBetween(prevDraw, latestDraw)} days
              earlier). “Improved” means moved toward or further inside the reference range;
              {" "}
              {compared.length < markers.length
                ? `${markers.length - compared.length} stayed about the same or have one draw.`
                : "every marker moved."}
            </p>
          )}
        </Card>
      )}

      <BloodworkSection />

      {GROUPS.map(({ status, title, eyebrow }) => {
        const list = byStatus.get(status);
        if (!list?.length) return null;
        return (
          <section key={status}>
            <SectionHeader
              eyebrow={eyebrow}
              title={`${title} · ${list.length}`}
              className="!mt-6"
            />
            <ListGroup>
              {list.map((t) => (
                <BiomarkerRow key={t.name} t={t} />
              ))}
            </ListGroup>
          </section>
        );
      })}

      <SectionHeader
        title="Tests & panels"
        className="!mt-8"
        action={
          <ButtonLink href="/items/new" variant="secondary" size="sm" icon="plus">
            Add test
          </ButtonLink>
        }
      />
      {tests.length > 0 ? (
        <ListGroup>
          {tests.map((t) => (
            <ListRow
              key={t.id}
              href={`/items/${t.id}`}
              icon="test-tube"
              iconTone={t.status === "queued" ? "warn" : "neutral"}
              title={t.name}
              subtitle={t.review_trigger ?? t.brand ?? undefined}
              trailing={TEST_STATUS[t.status] ?? t.status}
            />
          ))}
        </ListGroup>
      ) : (
        <Card padding="lg">
          <p className="text-callout text-[var(--foreground-soft)]">
            Track panels, scans and follow-ups so Coach can flag when a retest is due.
          </p>
        </Card>
      )}
      <div className="mt-3">
        <ButtonLink href="/data" variant="ghost" size="sm" icon="download">
          Import results
        </ButtonLink>
      </div>
    </div>
  );
}
