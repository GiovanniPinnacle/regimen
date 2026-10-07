"use client";

// Result card for a /scan photo analysis. Every scan type ends in a
// clear next action: food → log meal, supplement → add to stack,
// anything → discuss with Coach.

import { useEffect, useState, type ReactNode } from "react";
import Icon from "@/components/Icon";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Chip, { type ChipTone } from "@/components/ui/Chip";
import { Eyebrow } from "@/components/ui/Section";

export type ScanType = "food" | "supplement" | "scalp";

type CatalogMatch = {
  id: string;
  name: string;
  brand: string | null;
  item_type: string;
  serving_size: string | null;
  calories: number | null;
  protein_g: number | null;
  evidence_grade: string | null;
  coach_summary: string | null;
};

type Macros = {
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
};

const VERDICT_TONE: Record<"good" | "caution" | "bad" | "neutral", ChipTone> = {
  good: "success",
  caution: "warn",
  bad: "danger",
  neutral: "neutral",
};

const VERDICT_ICON = {
  good: "check-circle",
  caution: "alert",
  bad: "ban",
  neutral: "info",
} as const;

function humanize(s: string) {
  const t = s.replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function fireCoachAction(prompt: string) {
  window.dispatchEvent(
    new CustomEvent("regimen:ask", {
      detail: { text: prompt, send: true },
    }),
  );
}

export default function ScanAnalysis({
  type,
  analysis,
  note,
}: {
  type: ScanType;
  analysis: Record<string, unknown>;
  note: string;
}) {
  const verdict = analysis.verdict as string | undefined;
  const verdictTier =
    verdict === "safe" || verdict === "add" || verdict === "on_track"
      ? "good"
      : verdict === "caution" || verdict === "watch"
        ? "caution"
        : verdict === "avoid" || verdict === "skip" || verdict === "concerning"
          ? "bad"
          : "neutral";

  // Catalog match — for supplement scans, try to find the same product
  // already in our catalog so the user gets a one-tap "Add this exact
  // catalog entry" path with rich data, instead of relying solely on
  // Coach's text proposal. Runs once when the analysis loads.
  const [catalogMatches, setCatalogMatches] = useState<CatalogMatch[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  useEffect(() => {
    if (type !== "supplement") return;
    const name = analysis.name as string | undefined;
    if (!name?.trim()) return;
    let alive = true;
    (async () => {
      setCatalogLoading(true);
      try {
        const res = await fetch(
          `/api/catalog/search?q=${encodeURIComponent(name.trim())}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { items: CatalogMatch[] };
        if (!alive) return;
        // Take top 3 most-relevant
        setCatalogMatches((data.items ?? []).slice(0, 3));
      } finally {
        if (alive) setCatalogLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [type, analysis]);

  const story = (analysis.reasoning ?? analysis.narrative) as
    | string
    | undefined;
  const showAddToStack =
    type === "supplement" && (verdict === "add" || verdict === "caution");

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      {/* Verdict */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={VERDICT_TONE[verdictTier]} icon={VERDICT_ICON[verdictTier]}>
          {verdict ? humanize(verdict) : "No verdict"}
        </Chip>
        {analysis.day_post_op != null && (
          <span className="text-caption text-[var(--muted)]">
            Day {String(analysis.day_post_op)}
          </span>
        )}
      </div>

      {type === "food" && (
        <>
          {analysis.estimated_macros != null && (
            <MacroGrid macros={analysis.estimated_macros as Macros} />
          )}
          {Array.isArray(analysis.ingredients) && (
            <div>
              <Eyebrow className="mb-1">Ingredients</Eyebrow>
              <ul className="divide-y divide-[var(--border)]">
                {(
                  analysis.ingredients as Array<{
                    name: string;
                    flags: string[];
                  }>
                ).map((i, idx) => (
                  <li
                    key={idx}
                    className="flex min-h-[40px] items-center justify-between gap-2 py-1.5 text-callout"
                  >
                    <span className="min-w-0">{i.name}</span>
                    {i.flags && i.flags.length > 0 ? (
                      <div className="flex flex-wrap justify-end gap-1">
                        {i.flags.map((f) => (
                          <Chip
                            key={f}
                            tone={f === "hard_no" ? "danger" : "warn"}
                          >
                            {humanize(f)}
                          </Chip>
                        ))}
                      </div>
                    ) : (
                      <span className="shrink-0 text-caption text-[var(--muted)]">
                        OK
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {type === "scalp" && (
        <>
          {!!analysis.crusting && (
            <Field label="Crusting" value={String(analysis.crusting)} />
          )}
          {!!analysis.redness && (
            <Field label="Redness" value={String(analysis.redness)} />
          )}
          {Array.isArray(analysis.anomalies) &&
            analysis.anomalies.length > 0 && (
              <Field
                label="Watch"
                value={(analysis.anomalies as string[]).join(" · ")}
              />
            )}
          {Array.isArray(analysis.positive) &&
            analysis.positive.length > 0 && (
              <Field
                label="Positive"
                value={(analysis.positive as string[]).join(" · ")}
              />
            )}
        </>
      )}

      {type === "supplement" && (
        <>
          {analysis.name != null && (
            <Field
              label="Product"
              value={`${analysis.name}${analysis.brand ? ` (${analysis.brand})` : ""}`}
            />
          )}
          {Array.isArray(analysis.hard_no_hits) &&
            analysis.hard_no_hits.length > 0 && (
              <div>
                <Eyebrow className="mb-1.5">Conflicts with your hard NOs</Eyebrow>
                <div className="flex flex-wrap gap-1.5">
                  {(analysis.hard_no_hits as string[]).map((h) => (
                    <Chip key={h} tone="danger" icon="ban">
                      {h}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          {Array.isArray(analysis.duplicates) &&
            analysis.duplicates.length > 0 && (
              <Field
                label="Already in your stack"
                value={(analysis.duplicates as string[]).join(", ")}
              />
            )}
        </>
      )}

      {story && (
        <p className="text-callout leading-relaxed text-[var(--foreground-soft)]">
          {story}
        </p>
      )}

      {/* Catalog matches — when a supplement scan extracts a name, look
       *  it up in the catalog. If we find a hit, the user can pick it and
       *  inherit ALL the macros, micros, and Coach enrichment instantly
       *  (vs. starting from scratch with just OCR data). */}
      {type === "supplement" &&
        (catalogMatches.length > 0 || catalogLoading) && (
          <div>
            <Eyebrow className="mb-1.5">
              {catalogLoading
                ? "Looking for a match…"
                : `We know this product (${catalogMatches.length})`}
            </Eyebrow>
            <div className="overflow-hidden rounded-[14px] border border-[var(--border)] divide-y divide-[var(--border)]">
              {catalogMatches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    fireCoachAction(
                      `I just scanned ${m.name}${m.brand ? ` (${m.brand})` : ""}. ` +
                        `It matches a catalog entry I have data on (catalog_item_id=${m.id}). ` +
                        `Add it to my stack as a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format. ` +
                        `Use action: add and include catalog_item_id=${m.id} in extra so the user item links to the shared catalog row.` +
                        (note ? ` My note: "${note}"` : ""),
                    );
                  }}
                  className="flex min-h-[52px] w-full items-center gap-3 bg-[var(--surface-alt)] px-3 py-2 text-left transition-colors active:bg-[var(--surface)]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface)] text-[var(--foreground-soft)]">
                    <Icon name="pill" size={16} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-callout font-semibold">
                      {m.name}
                    </span>
                    <span className="block truncate text-caption text-[var(--muted)]">
                      {[
                        m.brand,
                        m.serving_size,
                        m.evidence_grade ? `Grade ${m.evidence_grade}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <Icon
                    name="chevron-right"
                    size={16}
                    strokeWidth={2}
                    className="shrink-0 text-[var(--muted)]"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

      {/* Action footer — every scan ends in a next step */}
      <div className="flex flex-wrap gap-2 pt-1">
        {showAddToStack && (
          <Button
            icon="plus"
            onClick={() => {
              const name = (analysis.name as string) ?? "this supplement";
              const brand = (analysis.brand as string) ?? "";
              const proposal = analysis.proposal as
                | Record<string, unknown>
                | undefined;
              const fields: string[] = [];
              if (proposal?.timing_slot)
                fields.push(`timing: ${proposal.timing_slot}`);
              if (proposal?.category)
                fields.push(`category: ${proposal.category}`);
              if (proposal?.frequency)
                fields.push(`frequency: ${proposal.frequency}`);
              if (Array.isArray(proposal?.goals))
                fields.push(`goals: ${(proposal.goals as string[]).join(",")}`);
              fireCoachAction(
                `Just scanned ${name}${brand ? ` (${brand})` : ""}. ` +
                  `Add it to my stack as a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format. ` +
                  (fields.length > 0
                    ? `Suggested fields: ${fields.join(", ")}.`
                    : "") +
                  (note ? ` My note: "${note}"` : ""),
              );
            }}
          >
            Add to stack
          </Button>
        )}
        {type === "food" && (
          <Button
            icon="plus"
            onClick={() => {
              const ingredients = Array.isArray(analysis.ingredients)
                ? (analysis.ingredients as Array<{ name: string }>)
                    .map((i) => i.name)
                    .slice(0, 5)
                    .join(", ")
                : "";
              const m = analysis.estimated_macros as Macros | undefined;
              fireCoachAction(
                `Log this meal in my intake log: ${ingredients || "what I just photographed"}. ` +
                  (m
                    ? `Estimated macros: ${m.calories} kcal, ${m.protein_g}g P, ${m.fat_g}g F, ${m.carbs_g}g C. `
                    : "") +
                  `Confirm and emit a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format with action: add.`,
              );
            }}
          >
            Log this meal
          </Button>
        )}
        <Button
          variant="secondary"
          icon="sparkle"
          onClick={() => {
            const summary = JSON.stringify(analysis, null, 2);
            fireCoachAction(
              `I just ran a ${type} scan and got this analysis. Help me decide what to do.\n\n` +
                "```json\n" +
                summary.slice(0, 1500) +
                "\n```",
            );
          }}
        >
          Discuss with Coach
        </Button>
      </div>
    </Card>
  );
}

/** kcal / P / F / C tiles. */
export function MacroGrid({ macros }: { macros: Partial<Macros> }) {
  const cells: { label: string; value: string }[] = [];
  if (macros.calories != null)
    cells.push({ label: "kcal", value: String(Math.round(macros.calories)) });
  if (macros.protein_g != null)
    cells.push({ label: "Protein", value: `${Math.round(macros.protein_g)}g` });
  if (macros.fat_g != null)
    cells.push({ label: "Fat", value: `${Math.round(macros.fat_g)}g` });
  if (macros.carbs_g != null)
    cells.push({ label: "Carbs", value: `${Math.round(macros.carbs_g)}g` });
  if (!cells.length) return null;
  return (
    <div className="grid grid-cols-4 gap-2">
      {cells.map((c) => (
        <div
          key={c.label}
          className="rounded-[14px] bg-[var(--surface-alt)] px-1 py-2.5 text-center"
        >
          <div className="text-title-3 leading-none tabular-nums">{c.value}</div>
          <div className="mt-1 text-caption text-[var(--muted)]">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-0.5 text-callout text-[var(--foreground-soft)]">
        {value}
      </div>
    </div>
  );
}
