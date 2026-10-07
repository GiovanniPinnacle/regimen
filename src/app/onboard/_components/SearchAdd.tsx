"use client";

// SearchAdd — type what you take, pick a catalog match (or add it as
// typed), and it lands on Today as an active item with a guessed timing
// slot. Shared by /onboard step 2 and the EmptyToday search sheet.

import { useState } from "react";
import Icon from "@/components/Icon";
import CatalogAutocomplete, {
  type PickedHit,
} from "@/components/CatalogAutocomplete";
import type { AddedItem } from "@/components/StarterPack";

export default function SearchAdd({
  onAdded,
  autoFocus = false,
}: {
  onAdded: (items: AddedItem[]) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add(item: {
    name: string;
    brand?: string | null;
    item_type?: string;
    catalog_item_id?: string;
  }) {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [item] }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        items?: AddedItem[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Couldn't add that.");
      setQuery("");
      window.dispatchEvent(new CustomEvent("regimen:items-changed"));
      onAdded(data.items ?? []);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function onPick(hit: PickedHit) {
    void add({
      name: hit.name,
      brand: hit.brand,
      item_type: hit.item_type,
      catalog_item_id: hit.catalog_item_id,
    });
  }

  const typed = query.trim();

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.length >= 2) void add({ name: typed });
        }}
        className="relative"
      >
        <Icon
          name="search"
          size={18}
          strokeWidth={1.9}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
        />
        <input
          type="search"
          inputMode="search"
          enterKeyHint="done"
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Magnesium, creatine, vitamin D…"
          aria-label="Search supplements and habits"
          className="input-field pl-11 text-[16px]"
          disabled={busy}
        />
      </form>

      {typed.length >= 2 && (
        <button
          type="button"
          onClick={() => void add({ name: typed })}
          disabled={busy}
          className="mt-2 flex min-h-[44px] w-full items-center gap-2 rounded-[12px] px-3 text-left text-callout text-[var(--foreground-soft)] active:bg-[var(--surface-alt)]"
        >
          <Icon name="plus" size={16} strokeWidth={2} />
          <span className="truncate">
            {busy ? "Adding…" : <>Add &ldquo;{typed}&rdquo; as typed</>}
          </span>
        </button>
      )}

      <CatalogAutocomplete query={query} onPick={onPick} disabled={busy} />

      {err && (
        <p className="mt-2 text-caption text-[var(--error)]" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
