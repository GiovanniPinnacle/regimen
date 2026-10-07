"use client";

// IntakeTracker — today's water / protein / calories vs targets, one-tap
// water, and today's entries. Used on /fuel and /today.
//
// Logging a meal goes through the one universal capture sheet (photo,
// voice or text) via the `regimen:capture` event with hint "meal" — no
// second meal flow lives here any more.
//
// Undo everywhere: water taps can be undone (deletes the row we just
// created) and entry deletes are deferred until the undo toast expires.

import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import Button, { IconButton } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/lib/toast";

type IntakeEntry = {
  id: string;
  logged_at: string;
  kind: "meal" | "snack" | "water" | "beverage";
  content: string;
  serving?: string | null;
  calories?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
  carbs_g?: number | null;
  water_oz?: number | null;
};

type Totals = {
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  water_oz: number;
  meal_count: number;
};

type Props = {
  /** Daily targets. When `water_oz` is omitted the tracker reads
   *  profiles.water_target_oz itself (default 84 oz). */
  targets?: {
    calories?: number;
    protein_g?: number;
    water_oz?: number;
  };
  /** Hide the entries list (e.g. a compact /today variant). */
  showEntries?: boolean;
};

export const DEFAULT_WATER_TARGET_OZ = 84;
const WATER_TAPS = [8, 12, 16];
const UNDO_MS = 5000;
const EMPTY: Totals = {
  calories: 0,
  protein_g: 0,
  fat_g: 0,
  carbs_g: 0,
  water_oz: 0,
  meal_count: 0,
};

function totalsOf(entries: IntakeEntry[]): Totals {
  const t = { ...EMPTY };
  for (const e of entries) {
    t.calories += Number(e.calories ?? 0);
    t.protein_g += Number(e.protein_g ?? 0);
    t.fat_g += Number(e.fat_g ?? 0);
    t.carbs_g += Number(e.carbs_g ?? 0);
    t.water_oz += Number(e.water_oz ?? 0);
    if (e.kind === "meal") t.meal_count++;
  }
  return t;
}

export function openMealCapture() {
  window.dispatchEvent(
    new CustomEvent("regimen:capture", { detail: { hint: "meal" } }),
  );
}

export default function IntakeTracker({ targets, showEntries = true }: Props) {
  const [entries, setEntries] = useState<IntakeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  /** Entries hidden while their undo window is open. */
  const [pendingDelete, setPendingDelete] = useState<Set<string>>(new Set());
  const [profileWater, setProfileWater] = useState<number | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const tempSeq = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/intake", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { entries?: IntakeEntry[] };
      setEntries(data.entries ?? []);
    } catch {
      // offline — keep what we have
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    const onChange = () => void load();
    window.addEventListener("regimen:items-changed", onChange);
    window.addEventListener("regimen:intake-changed", onChange);
    return () => {
      clearTimeout(id);
      window.removeEventListener("regimen:items-changed", onChange);
      window.removeEventListener("regimen:intake-changed", onChange);
    };
  }, [load]);

  // Water target: caller wins; otherwise the profile's own target.
  const needsProfileWater = targets?.water_oz == null;
  useEffect(() => {
    if (!needsProfileWater) return;
    let alive = true;
    (async () => {
      const { data } = await createClient()
        .from("profiles")
        .select("water_target_oz")
        .maybeSingle();
      if (alive) setProfileWater((data?.water_target_oz as number | null) ?? null);
    })();
    return () => {
      alive = false;
    };
  }, [needsProfileWater]);

  // Flush deferred deletes if the user navigates away mid-undo window.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const [id, t] of map) {
        clearTimeout(t);
        void fetch(`/api/intake?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
          keepalive: true,
        });
      }
      map.clear();
    };
  }, []);

  const visible = entries.filter((e) => !pendingDelete.has(e.id));
  const totals = totalsOf(visible);

  const waterTarget =
    targets?.water_oz ?? profileWater ?? DEFAULT_WATER_TARGET_OZ;
  const protTarget = targets?.protein_g ?? null;
  const calTarget = targets?.calories ?? null;

  async function addWater(oz: number) {
    tempSeq.current += 1;
    const tempId = `tmp-${tempSeq.current}`;
    const optimistic: IntakeEntry = {
      id: tempId,
      logged_at: new Date().toISOString(),
      kind: "water",
      content: `${oz} oz water`,
      water_oz: oz,
    };
    setEntries((prev) => [optimistic, ...prev]);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "water",
          content: `${oz} oz water`,
          water_oz: oz,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        entry?: IntakeEntry;
        error?: string;
      };
      if (!res.ok || !j.entry) throw new Error(j.error ?? "save failed");
      const saved = j.entry;
      setEntries((prev) => prev.map((e) => (e.id === tempId ? saved : e)));
      showToast(`Added ${oz} oz water`, {
        duration: UNDO_MS,
        undo: async () => {
          setEntries((prev) => prev.filter((e) => e.id !== saved.id));
          await fetch(`/api/intake?id=${encodeURIComponent(saved.id)}`, {
            method: "DELETE",
          });
          window.dispatchEvent(new CustomEvent("regimen:intake-changed"));
        },
      });
      window.dispatchEvent(new CustomEvent("regimen:intake-changed"));
    } catch {
      setEntries((prev) => prev.filter((e) => e.id !== tempId));
      showToast("Couldn't save that — check your connection", {
        tone: "error",
      });
    }
  }

  function removeEntry(entry: IntakeEntry) {
    setPendingDelete((s) => new Set(s).add(entry.id));
    const t = setTimeout(async () => {
      timers.current.delete(entry.id);
      const res = await fetch(
        `/api/intake?id=${encodeURIComponent(entry.id)}`,
        { method: "DELETE" },
      ).catch(() => null);
      if (!res || !res.ok) {
        setPendingDelete((s) => {
          const n = new Set(s);
          n.delete(entry.id);
          return n;
        });
        showToast("Couldn't delete that entry", { tone: "error" });
        return;
      }
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      setPendingDelete((s) => {
        const n = new Set(s);
        n.delete(entry.id);
        return n;
      });
      window.dispatchEvent(new CustomEvent("regimen:intake-changed"));
    }, UNDO_MS);
    timers.current.set(entry.id, t);
    showToast(`Removed ${entry.content}`, {
      duration: UNDO_MS,
      undo: () => {
        const pending = timers.current.get(entry.id);
        if (pending) clearTimeout(pending);
        timers.current.delete(entry.id);
        setPendingDelete((s) => {
          const n = new Set(s);
          n.delete(entry.id);
          return n;
        });
      },
    });
  }

  return (
    <section aria-label="Today's intake">
      <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-4">
          <ProgressRow
            icon="droplet"
            label="Water"
            value={totals.water_oz}
            target={waterTarget}
            unit="oz"
          />
          {protTarget != null && (
            <ProgressRow
              icon="dumbbell"
              label="Protein"
              value={totals.protein_g}
              target={protTarget}
              unit="g"
            />
          )}
          {calTarget != null && (
            <ProgressRow
              icon="flame"
              label="Calories"
              value={totals.calories}
              target={calTarget}
              unit="kcal"
              overIsWarn
            />
          )}
          {protTarget == null && calTarget == null && !loading && (
            <p className="text-footnote text-[var(--muted)]">
              Add your weight, height and age in Profile to get protein and
              calorie targets.
            </p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {WATER_TAPS.map((oz) => (
            <Button
              key={oz}
              variant="secondary"
              size="md"
              onClick={() => addWater(oz)}
              aria-label={`Add ${oz} ounces of water`}
            >
              +{oz} oz
            </Button>
          ))}
        </div>
        <Button
          variant="primary"
          size="md"
          icon="plus"
          fullWidth
          className="mt-2"
          onClick={openMealCapture}
        >
          Log a meal
        </Button>
      </div>

      {showEntries && (
        <div className="mt-3">
          {loading ? null : visible.length === 0 ? (
            <p className="px-1 py-2 text-footnote text-[var(--muted)]">
              Nothing logged yet today. Snap a photo or say what you ate —
              Coach estimates the macros.
            </p>
          ) : (
            <div className="overflow-hidden rounded-[20px] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
              {visible.slice(0, 12).map((e) => (
                <IntakeRow key={e.id} entry={e} onDelete={() => removeEntry(e)} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ProgressRow({
  icon,
  label,
  value,
  target,
  unit,
  overIsWarn,
}: {
  icon: "droplet" | "dumbbell" | "flame";
  label: string;
  value: number;
  target: number;
  unit: string;
  /** Calories: going well past target is a warning, not a win. */
  overIsWarn?: boolean;
}) {
  const ratio = target > 0 ? value / target : 0;
  const pct = Math.round(ratio * 100);
  const hit = overIsWarn ? ratio >= 0.9 && ratio <= 1.1 : ratio >= 1;
  const over = overIsWarn && ratio > 1.1;
  const fill = hit
    ? "var(--success)"
    : over
      ? "var(--warn)"
      : "var(--foreground)";
  const left = Math.max(0, Math.round(target - value));
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-2 text-callout font-semibold">
          <Icon
            name={icon}
            size={15}
            strokeWidth={1.8}
            className="text-[var(--muted)]"
          />
          {label}
        </span>
        <span className="flex items-baseline gap-1.5 tabular-nums">
          <span className="text-body font-bold">{Math.round(value)}</span>
          <span className="text-footnote text-[var(--muted)]">
            / {Math.round(target)} {unit}
          </span>
          <span
            className={`ml-1 min-w-[38px] text-right text-caption font-semibold ${
              hit
                ? "text-[var(--success)]"
                : over
                  ? "text-[var(--warn)]"
                  : "text-[var(--foreground-soft)]"
            }`}
          >
            {pct}%
          </span>
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-[var(--surface-alt)]"
        role="progressbar"
        aria-label={`${label}: ${Math.round(value)} of ${Math.round(target)} ${unit}`}
        aria-valuenow={Math.min(100, pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${Math.min(100, ratio * 100)}%`,
            background: fill,
            opacity: hit || over ? 1 : 0.85,
          }}
        />
      </div>
      {!hit && !over && value > 0 && (
        <div className="mt-1 text-caption text-[var(--muted)]">
          {left} {unit} to go
        </div>
      )}
    </div>
  );
}

function IntakeRow({
  entry,
  onDelete,
}: {
  entry: IntakeEntry;
  onDelete: () => void;
}) {
  const time = new Date(entry.logged_at).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const isWater = entry.kind === "water" || entry.kind === "beverage";
  const macros = [
    entry.calories != null && !isWater ? `${entry.calories} kcal` : null,
    entry.protein_g != null && !isWater
      ? `${Math.round(Number(entry.protein_g))}g protein`
      : null,
  ].filter(Boolean);
  return (
    <div className="flex min-h-[56px] items-center gap-3 py-1.5 pl-4 pr-1.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-alt)] text-[var(--foreground-soft)]">
        <Icon name={isWater ? "droplet" : "utensils"} size={16} strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-callout font-medium">{entry.content}</div>
        <div className="truncate text-caption text-[var(--muted)] tabular-nums">
          {time}
          {macros.length > 0 && ` · ${macros.join(" · ")}`}
        </div>
      </div>
      <IconButton
        icon="trash"
        label={`Delete ${entry.content}`}
        tone="plain"
        size={44}
        iconSize={17}
        onClick={onDelete}
      />
    </div>
  );
}
