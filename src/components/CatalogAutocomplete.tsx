"use client";

// CatalogAutocomplete — typeahead for the global catalog (USDA + Open
// Food Facts + DSLD + locally-saved). Renders below the name input as
// the user types. Picking a result pre-fills as much as we know:
// macros, micros, brand, category, item_type, ingredients, serving size.
//
// External hits (those without a local id) are imported lazily on pick
// via /api/catalog/import so the next user gets them instantly.

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import Chip, { type ChipTone } from "@/components/ui/Chip";
import type { NormalizedCatalogRecord } from "@/lib/catalog/types";

type SearchHit = NormalizedCatalogRecord & {
  id?: string; // local hits have an id; external don't
  _local?: boolean;
  evidence_grade?: string | null;
  coach_summary?: string | null;
};

type Props = {
  query: string;
  onPick: (hit: PickedHit) => void;
  /** When true, autocomplete is hidden (e.g. when user is editing). */
  disabled?: boolean;
};

/** Shape passed back to parent on pick — denormalized for ItemForm
 *  consumption. Includes catalog_item_id when this came from a local
 *  catalog row (so user item links to the shared entry). */
export type PickedHit = {
  catalog_item_id?: string;
  name: string;
  brand: string | null;
  item_type: string;
  category: string | null;
  serving_size: string | null;
  source: string;
  source_id: string | null;
  upc: string | null;
  active_ingredients:
    | { name: string; amount: number; unit: string }[]
    | null;
  micros: Record<string, number> | null;
};

const SOURCE_LABELS: Record<string, { label: string; tone: ChipTone }> = {
  off: { label: "Open Food Facts", tone: "neutral" },
  usda: { label: "USDA", tone: "neutral" },
  dsld: { label: "NIH DSLD", tone: "neutral" },
  manual: { label: "Curated", tone: "neutral" },
  coach: { label: "Coach", tone: "coach" },
};

export default function CatalogAutocomplete({
  query,
  onPick,
  disabled,
}: Props) {
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (disabled) {
      const id = setTimeout(() => setOpen(false), 0);
      return () => clearTimeout(id);
    }
    const q = query.trim();
    if (q.length < 2) {
      const id = setTimeout(() => {
        setHits([]);
        setOpen(false);
      }, 0);
      return () => clearTimeout(id);
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/catalog/search?q=${encodeURIComponent(q)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { items: SearchHit[] };
        setHits(data.items ?? []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, disabled]);

  // Coach generation fallback — fires when public sources had nothing
  async function generateWithCoach() {
    if (!query.trim() || generating) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/catalog/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: query.trim() }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (data.id) {
        // Re-run search now that the entry exists locally — it'll be the
        // top hit and the user can pick it
        const res2 = await fetch(
          `/api/catalog/search?q=${encodeURIComponent(query.trim())}`,
        );
        if (res2.ok) {
          const d2 = (await res2.json()) as { items: SearchHit[] };
          setHits(d2.items ?? []);
          setOpen(true);
        }
      }
    } finally {
      setGenerating(false);
    }
  }

  // Show even when no hits — so the "Generate with Coach" CTA surfaces
  if (!open) return null;

  async function handlePick(hit: SearchHit) {
    let catalogId: string | undefined = hit.id;
    // Import external hits so future users see them instantly
    if (!catalogId && !hit._local) {
      try {
        const res = await fetch("/api/catalog/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(hit),
        });
        const data = (await res.json()) as { id?: string };
        catalogId = data.id;
      } catch {
        // Best-effort — pick still works without the link
      }
    }
    onPick({
      catalog_item_id: catalogId,
      name: hit.name,
      brand: hit.brand ?? null,
      item_type: hit.item_type,
      category: hit.category ?? null,
      serving_size: hit.serving_size ?? null,
      source: hit.source,
      source_id: hit.source_id ?? null,
      upc: hit.upc ?? null,
      active_ingredients: hit.active_ingredients ?? null,
      micros: hit.micros ?? null,
    });
    setOpen(false);
  }

  return (
    <div className="mt-2 overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
      <div className="flex min-h-[36px] items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-alt)] px-3 py-1.5 text-caption text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5" aria-live="polite">
          <Icon name="search" size={13} strokeWidth={2} />
          {hits.length === 0
            ? "No matches yet"
            : `${hits.length} match${hits.length === 1 ? "" : "es"} in our catalog`}
        </span>
        {loading && (
          <span
            aria-label="Searching"
            className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
      </div>
      {hits.length === 0 && !loading && (
        <button
          type="button"
          onClick={generateWithCoach}
          disabled={generating}
          className="flex min-h-[56px] w-full items-start gap-3 px-3 py-3 text-left transition-colors active:bg-[var(--surface-alt)]"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--pro-tint)] text-[var(--pro-soft)]">
            <Icon name="sparkle" size={16} strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-callout font-semibold">
              {generating
                ? "Coach is looking this up…"
                : `Ask Coach to look up “${query.trim()}”`}
            </span>
            <span className="mt-0.5 block text-caption text-[var(--muted)]">
              Coach writes a profile with how it works, cautions and
              brand picks.
            </span>
          </span>
        </button>
      )}
      <ul className="divide-y divide-[var(--border)]">
        {hits.slice(0, 8).map((hit, i) => {
          const meta = SOURCE_LABELS[hit.source] ?? SOURCE_LABELS.manual;
          const details = [
            hit.brand,
            hit.serving_size,
            hit.calories != null ? `${Math.round(hit.calories)} kcal` : null,
            hit.protein_g != null ? `${Math.round(hit.protein_g)}g protein` : null,
            hit.evidence_grade ? `Grade ${hit.evidence_grade}` : null,
          ].filter(Boolean);
          return (
            <li key={`${hit.source}-${hit.id ?? hit.source_id ?? i}`}>
              <button
                type="button"
                onClick={() => handlePick(hit)}
                className="flex min-h-[52px] w-full items-center gap-3 px-3 py-2.5 text-left transition-colors active:bg-[var(--surface-alt)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-callout font-semibold">
                    {hit.name}
                  </span>
                  {details.length > 0 && (
                    <span className="mt-0.5 block truncate text-caption text-[var(--muted)]">
                      {details.join(" · ")}
                    </span>
                  )}
                </span>
                <Chip tone={meta.tone} className="shrink-0">
                  {meta.label}
                </Chip>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
