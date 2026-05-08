"use client";

// StarterPack — multi-select tap-to-add list of evidence-A foundational
// items, used in two surfaces:
//   1. The /onboard wizard's "common starters" step (between focus and
//      protocol pick) — gives a Day-1 user instant value
//   2. EmptyToday — the inline picker shown when a user lands on /today
//      with zero items
//
// UX rules:
//   - Each row has a checkbox; "Add N to my stack" button at bottom
//   - Default action is "queued" (planning to start) so /today doesn't
//     suddenly explode with stuff they may not have on hand
//   - Toggle "I already take these" → switches to "active" (started_on
//     = today, immediate Today rendering)
//   - Buy button per row falls back to Amazon search via affiliate API
//   - Skip button always present so users aren't trapped

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { showToast } from "@/lib/toast";

type StarterItem = {
  catalog_item_id: string;
  name: string;
  brand: string | null;
  item_type: string;
  category: string | null;
  evidence_grade: string | null;
  coach_summary: string | null;
  best_timing: string | null;
  why: string;
  bucket: string;
};

type Props = {
  /** Optional focus narrows the recs (recovery, sleep, fitness, etc.).
   *  Pass null/undefined to get the general foundation. */
  focus?: string | null;
  /** Max items to surface. Defaults to 12. */
  count?: number;
  /** Called after successful add so the parent can reload Today/Stack
   *  state. The component itself dispatches `regimen:items-changed`
   *  for cross-page refresh too. */
  onAdded?: (insertedCount: number) => void;
  /** Skip button — shown only when caller wires it (i.e. inside the
   *  /onboard wizard but not on EmptyToday where there's no "next step"). */
  onSkip?: () => void;
  /** Title override — defaults to "Quick starters". */
  title?: string;
  /** Subtitle override — defaults to a focus-aware blurb. */
  subtitle?: string;
};

export default function StarterPack({
  focus = null,
  count = 12,
  onAdded,
  onSkip,
  title = "Quick starters",
  subtitle,
}: Props) {
  const [items, setItems] = useState<StarterItem[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [taking, setTaking] = useState<"queued" | "active">("queued");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (focus) params.set("focus", focus);
        params.set("count", String(count));
        const r = await fetch(
          `/api/onboarding/starter-pack?${params.toString()}`,
          { credentials: "include" },
        );
        if (!r.ok) {
          if (alive) setItems([]);
          return;
        }
        const j = (await r.json()) as { items?: StarterItem[] };
        if (alive) setItems(j.items ?? []);
      } catch {
        if (alive) setItems([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [focus, count]);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function selectAll() {
    if (!items) return;
    setSelected(new Set(items.map((i) => i.catalog_item_id)));
  }
  function clearAll() {
    setSelected(new Set());
  }

  async function bulkAdd() {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/starter-pack/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ids: [...selected],
          status: taking,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      const data = (await res.json()) as {
        inserted: number;
        skipped: number;
      };
      showToast(
        data.inserted > 0
          ? `${data.inserted} added · ${taking === "active" ? "live now" : "in your queue"}`
          : "Already in your stack",
        { tone: "success" },
      );
      // Cross-page refresh so /stack + /today both pick up new items
      window.dispatchEvent(new CustomEvent("regimen:items-changed"));
      // Remove the chosen ones from the local list so the user sees
      // their picks vanish (and the remaining list shrinks).
      setItems((prev) =>
        (prev ?? []).filter((i) => !selected.has(i.catalog_item_id)),
      );
      setSelected(new Set());
      onAdded?.(data.inserted);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function buy(item: StarterItem) {
    try {
      const res = await fetch("/api/affiliates/click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: item.name,
          source: "starter_pack",
        }),
      });
      const data = (await res.json()) as { redirectUrl?: string };
      if (data.redirectUrl) {
        window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      // silent — Buy is a nice-to-have, not the main path
    }
  }

  if (items === null) {
    return (
      <section className="rounded-2xl card-glass p-5 text-center">
        <div className="text-[13px]" style={{ color: "var(--muted)" }}>
          Loading starters…
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return null;
  }

  const subtitleResolved =
    subtitle ??
    (focus
      ? `Tap to add the ones you take or want to try. We'll queue them so they don't all hit Today at once.`
      : `Foundational items most people start with. Tap to add — Coach can refine later.`);

  const allSelected = selected.size === items.length;

  return (
    <section className="rounded-2xl card-glass p-4 mb-5">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <div>
          <div
            className="text-[10px] uppercase tracking-wider"
            style={{
              color: "var(--olive)",
              fontWeight: 700,
              letterSpacing: "0.08em",
            }}
          >
            {items[0]?.bucket ?? "Foundation"} · evidence A/B
          </div>
          <h3
            className="text-[16px] mt-0.5 leading-tight"
            style={{ fontWeight: 600 }}
          >
            {title}
          </h3>
        </div>
        <button
          onClick={allSelected ? clearAll : selectAll}
          className="text-[11px] underline shrink-0"
          style={{ color: "var(--muted)" }}
          type="button"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>
      <p
        className="text-[12px] leading-relaxed mb-3"
        style={{ color: "var(--muted)" }}
      >
        {subtitleResolved}
      </p>

      <div className="flex flex-col gap-1.5">
        {items.map((item) => {
          const isSelected = selected.has(item.catalog_item_id);
          return (
            <button
              key={item.catalog_item_id}
              type="button"
              onClick={() => toggle(item.catalog_item_id)}
              className="rounded-xl px-3 py-2.5 flex items-center gap-2.5 text-left transition-all"
              style={{
                background: isSelected
                  ? "var(--olive-tint)"
                  : "var(--surface-alt)",
                border: isSelected
                  ? "1.5px solid var(--olive)"
                  : "1px solid var(--border)",
              }}
            >
              <span
                className="shrink-0 h-5 w-5 rounded-md flex items-center justify-center"
                style={{
                  background: isSelected ? "var(--olive)" : "transparent",
                  border: isSelected
                    ? "1px solid var(--olive)"
                    : "1.5px solid var(--border-strong)",
                }}
              >
                {isSelected && (
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                )}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className="text-[13.5px] leading-tight"
                    style={{ fontWeight: 600 }}
                  >
                    {item.name}
                  </span>
                  {item.evidence_grade === "A" && (
                    <span
                      className="text-[9px] px-1 py-[1px] rounded-sm uppercase tracking-wider"
                      style={{
                        background: "var(--accent-tint)",
                        color: "var(--accent)",
                        fontWeight: 700,
                      }}
                    >
                      A
                    </span>
                  )}
                </div>
                <div
                  className="text-[11.5px] mt-0.5 leading-snug"
                  style={{ color: "var(--muted)" }}
                >
                  {item.why}
                  {item.best_timing && (
                    <>
                      {" · "}
                      <span style={{ fontStyle: "italic" }}>
                        {item.best_timing}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  buy(item);
                }}
                aria-label={`Find ${item.name} online`}
                className="shrink-0 h-7 w-7 rounded-md flex items-center justify-center"
                style={{
                  background: "var(--surface)",
                  color: "var(--premium)",
                  border: "1px solid var(--border)",
                }}
              >
                <Icon name="shopping-bag" size={11} strokeWidth={2.2} />
              </button>
            </button>
          );
        })}
      </div>

      {/* Active vs queued toggle — defaults to queued so /today doesn't
          drown a new user in 12 unfamiliar checkoffs. */}
      <div className="flex items-center justify-between gap-2 mt-3">
        <div
          className="text-[11.5px]"
          style={{ color: "var(--muted)" }}
        >
          Add as
        </div>
        <div
          className="flex items-center rounded-full p-0.5"
          style={{
            background: "var(--surface-alt)",
            border: "1px solid var(--border)",
          }}
        >
          {(["queued", "active"] as const).map((mode) => {
            const isActive = taking === mode;
            return (
              <button
                key={mode}
                onClick={() => setTaking(mode)}
                type="button"
                className="text-[11.5px] px-2.5 py-1 rounded-full"
                style={{
                  background: isActive ? "var(--foreground)" : "transparent",
                  color: isActive ? "var(--background)" : "var(--muted)",
                  fontWeight: isActive ? 700 : 500,
                  minHeight: 26,
                }}
              >
                {mode === "queued" ? "Queue" : "Already taking"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={bulkAdd}
          disabled={selected.size === 0 || busy}
          className="flex-1 rounded-xl px-3 py-2.5 text-[13.5px]"
          style={{
            background: "var(--olive)",
            color: "#FFFFFF",
            fontWeight: 700,
            opacity: selected.size === 0 || busy ? 0.5 : 1,
            minHeight: 38,
          }}
        >
          {busy
            ? "Adding…"
            : selected.size === 0
              ? "Pick at least one"
              : `Add ${selected.size} ${selected.size === 1 ? "item" : "items"}`}
        </button>
        {onSkip && (
          <button
            onClick={onSkip}
            type="button"
            disabled={busy}
            className="rounded-xl px-3 py-2.5 text-[13px]"
            style={{
              background: "var(--surface-alt)",
              color: "var(--muted)",
              fontWeight: 500,
              minHeight: 38,
            }}
          >
            Skip
          </button>
        )}
      </div>
      {err && (
        <div
          className="text-[12px] mt-2 px-3 py-2 rounded-lg"
          style={{
            background: "rgba(176, 0, 32, 0.08)",
            color: "var(--error)",
          }}
        >
          {err}
        </div>
      )}
    </section>
  );
}
