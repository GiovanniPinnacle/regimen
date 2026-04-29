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

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  off: { label: "Open Food Facts", color: "var(--accent)" },
  usda: { label: "USDA", color: "var(--pro)" },
  dsld: { label: "NIH DSLD", color: "var(--premium)" },
  manual: { label: "Curated", color: "var(--accent)" },
  coach: { label: "Coach", color: "var(--pro)" },
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
      setOpen(false);
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setOpen(false);
      return;
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
    <div
      className="rounded-2xl mt-2 overflow-hidden"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        className="px-3 py-1.5 text-[10px] uppercase tracking-wider flex items-center justify-between"
        style={{
          color: "var(--muted)",
          fontWeight: 700,
          letterSpacing: "0.08em",
          background: "var(--surface-alt)",
        }}
      >
        <span className="inline-flex items-center gap-1.5">
          <Icon name="search" size={11} strokeWidth={2} />
          {hits.length === 0
            ? "No matches yet"
            : `${hits.length} match${hits.length === 1 ? "" : "es"} from our catalog`}
        </span>
        {loading && <span>…</span>}
      </div>
      {hits.length === 0 && !loading && (
        <button
          type="button"
          onClick={generateWithCoach}
          disabled={generating}
          className="w-full px-3 py-3 text-left flex items-start gap-2.5 active:scale-[0.99] transition-transform"
        >
          <span
            className="shrink-0 mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center"
            style={{
              background: "var(--pro-tint)",
              color: "var(--pro)",
            }}
          >
            <Icon name="sparkle" size={13} strokeWidth={2} />
          </span>
          <div className="flex-1 min-w-0">
            <div
              className="text-[13px] leading-snug"
              style={{ fontWeight: 600 }}
            >
              {generating
                ? "Coach is researching this…"
                : `Have Coach research "${query.trim()}"`}
            </div>
            <div
              className="text-[11px] mt-0.5 leading-snug"
              style={{ color: "var(--muted)" }}
            >
              Coach generates a structured catalog entry with mechanism,
              cautions, brand picks
            </div>
          </div>
        </button>
      )}
      {hits.slice(0, 8).map((hit, i) => {
        const meta = SOURCE_LABELS[hit.source] ?? SOURCE_LABELS.manual;
        return (
          <button
            key={`${hit.source}-${hit.id ?? hit.source_id ?? i}`}
            type="button"
            onClick={() => handlePick(hit)}
            className="w-full text-left px-3 py-2.5"
            style={{
              borderTop: i > 0 ? "1px solid var(--border)" : undefined,
            }}
          >
            <div className="flex items-baseline justify-between gap-2 mb-0.5">
              <div
                className="text-[13.5px] truncate"
                style={{ fontWeight: 600 }}
              >
                {hit.name}
              </div>
              <span
                className="text-[9.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                style={{
                  background: `${meta.color}1F`,
                  color: meta.color,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                }}
              >
                {meta.label}
              </span>
            </div>
            <div
              className="text-[11px] flex flex-wrap gap-x-2 gap-y-0.5"
              style={{ color: "var(--muted)" }}
            >
              {hit.brand && <span>{hit.brand}</span>}
              {hit.serving_size && <span>· {hit.serving_size}</span>}
              {hit.calories != null && (
                <span>· {Math.round(hit.calories)} kcal</span>
              )}
              {hit.protein_g != null && (
                <span>· {Math.round(hit.protein_g)}g P</span>
              )}
              {hit.evidence_grade && <span>· Grade {hit.evidence_grade}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
