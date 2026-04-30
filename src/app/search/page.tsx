"use client";

// Global search — find items, protocols, voice memos, recipes from one
// input. Debounced. Grouped results. Tap to navigate.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import EmptyState from "@/components/EmptyState";

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
  // Recent searches — populated lazily on mount so SSR doesn't hit
  // localStorage. Updated whenever a non-empty query lands a hit.
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const debouncerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setRecent(loadRecentSearches());
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debouncerRef.current) clearTimeout(debouncerRef.current);
    if (q.trim().length < 2) {
      setHits([]);
      setCounts(null);
      return;
    }
    setLoading(true);
    debouncerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q.trim())}`,
        );
        if (!res.ok) {
          setHits([]);
          setCounts(null);
          return;
        }
        const data = await res.json();
        const newHits: Hit[] = data.hits ?? [];
        setHits(newHits);
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
    !loading && q.trim().length >= 2 && hits.length === 0;

  return (
    <div className="pb-24">
      <header className="mb-5">
        <h1
          className="text-[32px] leading-tight"
          style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          Search
        </h1>
        <p
          className="text-[13px] mt-1"
          style={{ color: "var(--muted)" }}
        >
          Items, protocols, voice memos, recipes — all in one place.
        </p>
      </header>

      <div
        className="rounded-2xl flex items-center gap-2 px-4 py-3 mb-5"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <Icon
          name="search"
          size={18}
          className="opacity-60 shrink-0"
        />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search anything…"
          className="flex-1 text-[15px] focus:outline-none"
          style={{
            background: "transparent",
            color: "var(--foreground)",
          }}
        />
        {q && (
          <button
            onClick={() => {
              setQ("");
              inputRef.current?.focus();
            }}
            className="shrink-0 leading-none px-1"
            style={{ color: "var(--muted)" }}
            aria-label="Clear"
          >
            <Icon name="plus" size={14} className="rotate-45" />
          </button>
        )}
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
        <div
          className="text-[12px] text-center py-6"
          style={{ color: "var(--muted)" }}
        >
          Searching…
        </div>
      )}

      {showEmpty && (
        <EmptyState
          icon="🔎"
          title={`Nothing matching "${q}"`}
          body="Try a shorter keyword or check the spelling."
        />
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
                  icon="check-circle"
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
              title="Voice memos"
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
                    icon="sparkle"
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
  // Always show some good defaults; surface the user's recent searches
  // FIRST when they exist so the most-likely next query is one tap away.
  const STARTERS = [
    "Magnesium",
    "FUE recovery",
    "Sleep",
    "Tongkat",
    "Bone broth",
    "Vitamin D",
  ];
  return (
    <section className="flex flex-col gap-5">
      {recent.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h2
              className="text-[11px] uppercase tracking-wider"
              style={{
                color: "var(--muted)",
                fontWeight: 600,
                letterSpacing: "0.06em",
              }}
            >
              Recent
            </h2>
            <button
              onClick={onClear}
              className="text-[11px]"
              style={{ color: "var(--muted)" }}
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((t) => (
              <button
                key={t}
                onClick={() => onPick(t)}
                className="text-[12px] px-3 py-1.5 rounded-full inline-flex items-center gap-1.5"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                  fontWeight: 500,
                }}
              >
                <Icon name="clock" size={11} className="opacity-50" />
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2
          className="text-[11px] uppercase tracking-wider mb-2"
          style={{
            color: "var(--muted)",
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}
        >
          {recent.length > 0 ? "Or try" : "Try searching for"}
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {STARTERS.map((t) => (
            <button
              key={t}
              onClick={() => onPick(t)}
              className="text-[12px] px-3 py-1.5 rounded-full"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--muted)",
              }}
            >
              {t}
            </button>
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
      <div className="flex items-baseline justify-between mb-2">
        <h2
          className="text-[11px] uppercase tracking-wider"
          style={{
            color: "var(--muted)",
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}
        >
          {title}
        </h2>
        <span
          className="text-[11px]"
          style={{ color: "var(--muted)" }}
        >
          {count}
        </span>
      </div>
      <div className="rounded-2xl card-glass overflow-hidden">{children}</div>
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
  icon: Parameters<typeof Icon>[0]["name"];
  primary: string;
  secondary?: string | null;
  badge?: string | null;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <span
        className="shrink-0 h-8 w-8 rounded-lg flex items-center justify-center"
        style={{
          background: "var(--olive-tint)",
          color: "var(--olive)",
        }}
      >
        <Icon name={icon} size={15} strokeWidth={1.7} />
      </span>
      <div className="flex-1 min-w-0">
        <div
          className="text-[14px] truncate"
          style={{ fontWeight: 500 }}
        >
          {primary}
        </div>
        {secondary && (
          <div
            className="text-[12px] truncate"
            style={{ color: "var(--muted)" }}
          >
            {secondary}
          </div>
        )}
      </div>
      {badge && (
        <span
          className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
          style={{
            background: "var(--surface-alt)",
            color: "var(--muted)",
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}
        >
          {badge}
        </span>
      )}
      <Icon
        name="chevron-right"
        size={14}
        className="shrink-0 opacity-40"
      />
    </Link>
  );
}
