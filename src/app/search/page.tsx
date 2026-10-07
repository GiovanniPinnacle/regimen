"use client";

// Global search — find items, protocols, voice memos, recipes from one
// input. Debounced. Grouped results. Tap to navigate.

import { useEffect, useRef, useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button, { IconButton } from "@/components/ui/Button";
import Chip, { ChipButton } from "@/components/ui/Chip";
import { Eyebrow } from "@/components/ui/Section";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import { ITEM_TYPE_ICON_NAME } from "@/lib/constants";
import { openCoach } from "@/lib/coach-events";

type Hit =
  | {
      kind: "item";
      id: string;
      name: string;
      brand?: string | null;
      status: string;
      item_type: string;
      href: string;
    }
  | {
      kind: "protocol";
      slug: string;
      name: string;
      tagline: string;
      href: string;
    }
  | {
      kind: "memo";
      id: string;
      transcript: string;
      created_at: string;
      context_tag: string | null;
      href: string;
    }
  | { kind: "recipe"; id: string; name: string; href: string }
  | {
      kind: "catalog";
      id: string;
      name: string;
      brand: string | null;
      item_type: string;
      evidence_grade: string | null;
      href: string;
    };

const RECENT_SEARCH_KEY = "regimen.search.recent.v1";
const MAX_RECENT = 8;

function loadRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCH_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}
function saveRecentSearch(q: string) {
  if (typeof window === "undefined") return;
  const trimmed = q.trim();
  if (trimmed.length < 2) return;
  try {
    const current = loadRecentSearches();
    const next = [
      trimmed,
      ...current.filter(
        (x) => x.toLowerCase() !== trimmed.toLowerCase(),
      ),
    ].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next));
  } catch {}
}

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [counts, setCounts] = useState<{
    items: number;
    protocols: number;
    memos: number;
    recipes: number;
    catalog?: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  /** The query the current `hits` answer — avoids flashing "nothing
   *  found" while the debounce is still pending. */
  const [answered, setAnswered] = useState("");
  // Recent searches — populated lazily on mount so SSR doesn't hit
  // localStorage. Updated whenever a non-empty query lands a hit.
  const [recent, setRecent] = useState<string[]>(() => loadRecentSearches());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debouncerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debouncerRef.current) clearTimeout(debouncerRef.current);
    if (q.trim().length < 2) {
      const id = setTimeout(() => {
        setHits([]);
        setCounts(null);
      }, 0);
      return () => clearTimeout(id);
    }
    debouncerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q.trim())}`,
        );
        if (!res.ok) {
          setHits([]);
          setCounts(null);
          setAnswered(q.trim());
          return;
        }
        const data = await res.json();
        const newHits: Hit[] = data.hits ?? [];
        setHits(newHits);
        setAnswered(q.trim());
        setCounts(data.counts ?? null);
        // Save the query as a "recent search" once we get at least one
        // hit — avoids polluting recents with typos. Pure local-storage
        // ops, no network call.
        if (newHits.length > 0) {
          saveRecentSearch(q);
          setRecent(loadRecentSearches());
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debouncerRef.current) clearTimeout(debouncerRef.current);
    };
  }, [q]);

  const groups = {
    item: hits.filter((h): h is Extract<Hit, { kind: "item" }> => h.kind === "item"),
    protocol: hits.filter(
      (h): h is Extract<Hit, { kind: "protocol" }> => h.kind === "protocol",
    ),
    recipe: hits.filter(
      (h): h is Extract<Hit, { kind: "recipe" }> => h.kind === "recipe",
    ),
    memo: hits.filter((h): h is Extract<Hit, { kind: "memo" }> => h.kind === "memo"),
    catalog: hits.filter(
      (h): h is Extract<Hit, { kind: "catalog" }> => h.kind === "catalog",
    ),
  };

  const showEmpty =
    !loading &&
    q.trim().length >= 2 &&
    answered === q.trim() &&
    hits.length === 0;

  return (
    <div className="pb-28">
      <PageHeader title="Search" showCoach={false} />

      <div className="sticky top-0 z-10 -mx-5 mb-5 bg-[var(--background)] px-5 pb-2 pt-1">
        <div className="flex min-h-[48px] items-center gap-2 rounded-[14px] border border-[var(--border-input)] bg-[var(--surface)] pl-3.5 pr-1 focus-within:border-[var(--border-strong)]">
          <Icon name="search" size={18} className="shrink-0 text-[var(--muted)]" />
          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Items, protocols, recipes, notes…"
            aria-label="Search"
            className="min-w-0 flex-1 bg-transparent text-body text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus-visible:shadow-none"
          />
          {q && (
            <IconButton
              icon="x"
              label="Clear search"
              tone="plain"
              size={36}
              iconSize={16}
              onClick={() => {
                setQ("");
                inputRef.current?.focus();
              }}
            />
          )}
        </div>
      </div>

      {q.trim().length < 2 && (
        <SearchSuggestions
          recent={recent}
          onPick={(t) => setQ(t)}
          onClear={() => {
            try {
              localStorage.removeItem(RECENT_SEARCH_KEY);
            } catch {}
            setRecent([]);
          }}
        />
      )}

      {loading && q.trim().length >= 2 && (
        <p className="py-6 text-center text-footnote text-[var(--muted)]">
          Searching…
        </p>
      )}

      {showEmpty && (
        <Card padding="lg" className="text-center">
          <div className="text-title-3">Nothing for &ldquo;{q.trim()}&rdquo;</div>
          <p className="mt-1 text-callout text-[var(--muted)]">
            Try a shorter word, or ask Coach instead.
          </p>
          <div className="mt-4 flex justify-center">
            <Button
              variant="coach"
              icon="sparkle"
              onClick={() => openCoach({ text: q.trim() })}
            >
              Ask Coach
            </Button>
          </div>
        </Card>
      )}

      {!loading && hits.length > 0 && (
        <div className="flex flex-col gap-6">
          {groups.item.length > 0 && (
            <ResultGroup
              title="Items"
              count={counts?.items ?? groups.item.length}
            >
              {groups.item.map((h) => (
                <ResultRow
                  key={`i-${h.id}`}
                  href={h.href}
                  icon={(ITEM_TYPE_ICON_NAME as Record<string, IconName>)[h.item_type] ?? "pill"}
                  primary={h.name}
                  secondary={[h.brand, h.item_type].filter(Boolean).join(" · ")}
                  badge={h.status === "active" ? null : h.status}
                />
              ))}
            </ResultGroup>
          )}

          {groups.protocol.length > 0 && (
            <ResultGroup
              title="Protocols"
              count={counts?.protocols ?? groups.protocol.length}
            >
              {groups.protocol.map((h) => (
                <ResultRow
                  key={`p-${h.slug}`}
                  href={h.href}
                  icon="award"
                  primary={h.name}
                  secondary={h.tagline}
                />
              ))}
            </ResultGroup>
          )}

          {groups.recipe.length > 0 && (
            <ResultGroup
              title="Recipes"
              count={counts?.recipes ?? groups.recipe.length}
            >
              {groups.recipe.map((h) => (
                <ResultRow
                  key={`r-${h.id}`}
                  href={h.href}
                  icon="book"
                  primary={h.name}
                />
              ))}
            </ResultGroup>
          )}

          {groups.catalog.length > 0 && (
            <ResultGroup
              title="Add from catalog"
              count={counts?.catalog ?? groups.catalog.length}
            >
              {groups.catalog.map((h) => (
                <ResultRow
                  key={`c-${h.id}`}
                  href={h.href}
                  icon="plus"
                  primary={h.name}
                  secondary={[h.brand, h.item_type]
                    .filter(Boolean)
                    .join(" · ")}
                  badge={h.evidence_grade ? `Grade ${h.evidence_grade}` : null}
                />
              ))}
            </ResultGroup>
          )}

          {groups.memo.length > 0 && (
            <ResultGroup
              title="Notes"
              count={counts?.memos ?? groups.memo.length}
            >
              {groups.memo.map((h) => {
                const date = new Date(h.created_at).toLocaleDateString(
                  undefined,
                  { month: "short", day: "numeric" },
                );
                return (
                  <ResultRow
                    key={`m-${h.id}`}
                    href={h.href}
                    icon="mic"
                    primary={
                      h.transcript.slice(0, 80) +
                      (h.transcript.length > 80 ? "…" : "")
                    }
                    secondary={`${date}${h.context_tag ? ` · ${h.context_tag}` : ""}`}
                  />
                );
              })}
            </ResultGroup>
          )}
        </div>
      )}
    </div>
  );
}

function SearchSuggestions({
  recent,
  onPick,
  onClear,
}: {
  recent: string[];
  onPick: (q: string) => void;
  onClear: () => void;
}) {
  const STARTERS = ["Magnesium", "Sleep", "Protein", "Vitamin D", "Creatine", "Recovery"];
  return (
    <section className="flex flex-col gap-6">
      {recent.length > 0 && (
        <div>
          <div className="mb-2.5 flex items-center justify-between px-1">
            <Eyebrow>Recent</Eyebrow>
            <button
              type="button"
              onClick={onClear}
              className="-my-3 min-h-[44px] px-2 text-footnote font-medium text-[var(--foreground-soft)]"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((t) => (
              <ChipButton key={t} icon="clock" onClick={() => onPick(t)}>
                {t}
              </ChipButton>
            ))}
          </div>
        </div>
      )}
      <div>
        <Eyebrow className="mb-2.5 px-1">
          {recent.length > 0 ? "Or try" : "Try"}
        </Eyebrow>
        <div className="flex flex-wrap gap-2">
          {STARTERS.map((t) => (
            <ChipButton key={t} onClick={() => onPick(t)}>
              {t}
            </ChipButton>
          ))}
        </div>
      </div>
    </section>
  );
}

function ResultGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between px-1">
        <Eyebrow>{title}</Eyebrow>
        <span className="text-caption tabular-nums text-[var(--muted)]">{count}</span>
      </div>
      <ListGroup>{children}</ListGroup>
    </section>
  );
}

function ResultRow({
  href,
  icon,
  primary,
  secondary,
  badge,
}: {
  href: string;
  icon: IconName;
  primary: string;
  secondary?: string | null;
  badge?: string | null;
}) {
  return (
    <ListRow
      href={href}
      icon={icon}
      title={primary}
      subtitle={secondary || undefined}
      trailing={badge ? <Chip size="sm">{badge}</Chip> : undefined}
    />
  );
}
