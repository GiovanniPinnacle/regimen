"use client";

// IntakeTracker — the lazy-tracking surface on /today.
// Tap-to-add water, photo/voice/text quick-log meals, running daily totals
// vs targets, recent entries. Designed for the "society is lazy" UX
// principle: one tap should be the maximum effort to log most things.

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { uploadPhoto } from "@/lib/photo";

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
  photo_url?: string | null;
  analyzed_by?: string | null;
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
  /** Daily targets — passed from Today (computed from profile). */
  targets?: {
    calories?: number;
    protein_g?: number;
    water_oz?: number;
  };
};

const WATER_TAPS = [
  { oz: 8, label: "8 oz" },
  { oz: 12, label: "12 oz" },
  { oz: 16, label: "16 oz" },
];

export default function IntakeTracker({ targets }: Props) {
  const [entries, setEntries] = useState<IntakeEntry[]>([]);
  const [totals, setTotals] = useState<Totals>({
    calories: 0,
    protein_g: 0,
    fat_g: 0,
    carbs_g: 0,
    water_oz: 0,
    meal_count: 0,
  });
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logSheet, setLogSheet] = useState<"meal" | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/intake");
      if (!res.ok) return;
      const data = await res.json();
      setEntries(data.entries ?? []);
      setTotals(data.totals ?? totals);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function addWater(oz: number) {
    // Optimistic
    setTotals((t) => ({ ...t, water_oz: t.water_oz + oz }));
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
      if (!res.ok) throw new Error("save failed");
      await load();
    } catch {
      // Rollback
      setTotals((t) => ({ ...t, water_oz: Math.max(0, t.water_oz - oz) }));
    }
  }

  const waterTarget = targets?.water_oz ?? 84;
  const protTarget = targets?.protein_g ?? null;
  const calTarget = targets?.calories ?? null;

  return (
    <>
      <section
        className="rounded-2xl card-glass mb-4 overflow-hidden"
      >
        {/* Header bar */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full px-4 py-3 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <span
              className="text-[16px] leading-none"
              aria-hidden
            >
              🍽
            </span>
            <span
              className="text-[11px] uppercase tracking-wider"
              style={{
                color: "var(--muted)",
                fontWeight: 600,
                letterSpacing: "0.06em",
              }}
            >
              Today's intake
            </span>
            {totals.meal_count > 0 && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: "var(--olive-tint)",
                  color: "var(--olive)",
                  fontWeight: 600,
                }}
              >
                {totals.meal_count}{" "}
                {totals.meal_count === 1 ? "meal" : "meals"}
              </span>
            )}
          </div>
          <Icon
            name="chevron-down"
            size={16}
            className="transition-transform"
          />
        </button>

        {/* Progress bars — always visible */}
        <div className="px-4 pb-3 flex flex-col gap-2">
          <ProgressRow
            label="Water"
            value={totals.water_oz}
            target={waterTarget}
            unit="oz"
            color="var(--purple)"
          />
          {protTarget != null && (
            <ProgressRow
              label="Protein"
              value={Math.round(totals.protein_g)}
              target={protTarget}
              unit="g"
              color="var(--olive)"
            />
          )}
          {calTarget != null && (
            <ProgressRow
              label="Calories"
              value={totals.calories}
              target={calTarget}
              unit=""
              color="var(--warn)"
            />
          )}
        </div>

        {/* Quick add — always visible */}
        <div
          className="px-3 pb-3 flex flex-wrap gap-1.5"
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: "10px",
          }}
        >
          {WATER_TAPS.map((t) => (
            <button
              key={t.oz}
              onClick={() => addWater(t.oz)}
              className="text-[12px] px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--purple)",
                fontWeight: 500,
              }}
            >
              💧 {t.label}
            </button>
          ))}
          <button
            onClick={() => setLogSheet("meal")}
            className="text-[12px] px-3 py-1.5 rounded-full flex items-center gap-1.5"
            style={{
              background: "var(--olive)",
              color: "#FBFAF6",
              fontWeight: 500,
            }}
          >
            <Icon name="plus" size={12} strokeWidth={2.4} />
            Log meal
          </button>
        </div>

        {/* Recent entries — expandable */}
        {expanded && (
          <div
            className="px-3 pb-3 flex flex-col gap-1.5"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div
              className="text-[10px] uppercase tracking-wider mt-2 mb-1"
              style={{ color: "var(--muted)", fontWeight: 600, letterSpacing: "0.06em" }}
            >
              Recent
            </div>
            {loading ? (
              <div
                className="text-[12px]"
                style={{ color: "var(--muted)" }}
              >
                Loading…
              </div>
            ) : entries.length === 0 ? (
              <div
                className="text-[12px] py-2"
                style={{ color: "var(--muted)" }}
              >
                Nothing logged yet today.
              </div>
            ) : (
              entries.slice(0, 10).map((e) => (
                <IntakeRow key={e.id} entry={e} onDelete={load} />
              ))
            )}
          </div>
        )}
      </section>

      {logSheet === "meal" && (
        <MealLogSheet
          onClose={() => setLogSheet(null)}
          onLogged={() => {
            setLogSheet(null);
            void load();
          }}
        />
      )}
    </>
  );
}

function ProgressRow({
  label,
  value,
  target,
  unit,
  color,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  color: string;
}) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const over = value > target;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span
          className="text-[12px]"
          style={{ color: "var(--muted)" }}
        >
          {label}
        </span>
        <span
          className="text-[12px] tabular-nums"
          style={{
            color: over ? "var(--warn)" : "var(--foreground)",
            fontWeight: 500,
          }}
        >
          <span style={{ fontWeight: 600 }}>{Math.round(value)}</span>
          <span style={{ color: "var(--muted)" }}>
            {" "}
            / {target}
            {unit && ` ${unit}`}
          </span>
        </span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--surface-alt)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: color,
          }}
        />
      </div>
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
  const [deleting, setDeleting] = useState(false);
  const time = new Date(entry.logged_at).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  async function remove() {
    setDeleting(true);
    try {
      await fetch(`/api/intake?id=${entry.id}`, { method: "DELETE" });
      onDelete();
    } finally {
      setDeleting(false);
    }
  }

  const kindIcon =
    entry.kind === "water"
      ? "💧"
      : entry.kind === "beverage"
        ? "☕"
        : entry.kind === "snack"
          ? "🥨"
          : "🍽";

  return (
    <div
      className="flex items-start gap-2 py-1.5"
      style={{ opacity: deleting ? 0.4 : 1 }}
    >
      <span className="text-[14px] leading-none mt-0.5 shrink-0">
        {kindIcon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className="text-[10px] tabular-nums shrink-0"
            style={{ color: "var(--muted)" }}
          >
            {time}
          </span>
          <span className="text-[12px] truncate">{entry.content}</span>
        </div>
        {entry.kind !== "water" && (entry.calories || entry.protein_g) && (
          <div
            className="text-[10px] flex gap-2"
            style={{ color: "var(--muted)" }}
          >
            {entry.calories != null && <span>{entry.calories} kcal</span>}
            {entry.protein_g != null && (
              <span>{Math.round(Number(entry.protein_g))}g P</span>
            )}
          </div>
        )}
      </div>
      <button
        onClick={remove}
        className="text-[10px] px-1.5 py-0.5 shrink-0"
        style={{ color: "var(--muted)" }}
        aria-label="Delete entry"
        disabled={deleting}
      >
        <Icon name="trash" size={12} />
      </button>
    </div>
  );
}

// ============== Meal log sheet ==============
function MealLogSheet({
  onClose,
  onLogged,
}: {
  onClose: () => void;
  onLogged: () => void;
}) {
  const [mode, setMode] = useState<"photo" | "text">("text");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"idle" | "uploading" | "analyzing" | "saving">("idle");
  const [err, setErr] = useState<string | null>(null);

  async function logText() {
    if (!text.trim()) return;
    setBusy(true);
    setStage("saving");
    setErr(null);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "meal",
          content: text.trim(),
          analyze: true,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      onLogged();
    } catch (e) {
      setErr((e as Error).message);
      setStage("idle");
    } finally {
      setBusy(false);
    }
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    setStage("uploading");
    try {
      const upload = await uploadPhoto(file, "meal-photos");
      if ("error" in upload) throw new Error(upload.error);
      setStage("analyzing");
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "food",
          imageUrl: upload.publicUrl,
          path: upload.path,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      // /api/analyze writes to intake_log directly, so just close
      onLogged();
    } catch (e) {
      setErr((e as Error).message);
      setStage("idle");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{
        background: "rgba(31, 26, 20, 0.5)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-5 pb-8 glass-strong"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 1.5rem)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between gap-2 mb-4">
          <div>
            <div
              className="text-[11px] uppercase tracking-wider"
              style={{ color: "var(--muted)", fontWeight: 500, letterSpacing: "0.06em" }}
            >
              Log meal
            </div>
            <div className="text-[16px] mt-1" style={{ fontWeight: 500 }}>
              Photo or describe — Claude estimates macros.
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[20px] leading-none px-2"
            style={{ color: "var(--muted)" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div
          className="grid grid-cols-2 gap-1 p-1 rounded-2xl mb-4"
          style={{ background: "var(--surface-alt)" }}
        >
          {(["photo", "text"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="rounded-xl py-2 text-[13px]"
              style={{
                background: mode === m ? "var(--surface)" : "transparent",
                color: mode === m ? "var(--foreground)" : "var(--muted)",
                fontWeight: mode === m ? 600 : 500,
                boxShadow:
                  mode === m
                    ? "0 1px 4px rgba(31, 26, 20, 0.08)"
                    : undefined,
              }}
            >
              {m === "photo" ? "📷 Photo" : "✍ Text"}
            </button>
          ))}
        </div>

        {mode === "photo" && (
          <div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhoto}
              className="hidden"
              id="meal-photo-input"
            />
            <label
              htmlFor="meal-photo-input"
              className="block w-full rounded-2xl px-4 py-8 text-center cursor-pointer"
              style={{
                background: "var(--olive)",
                color: "#FBFAF6",
                fontWeight: 500,
                opacity: busy ? 0.5 : 1,
              }}
            >
              <div className="text-[40px] mb-2">📷</div>
              <div className="text-[14px]">
                {stage === "uploading"
                  ? "Uploading…"
                  : stage === "analyzing"
                    ? "Claude analyzing…"
                    : "Take or upload a photo"}
              </div>
              <div className="text-[11px] mt-1" style={{ opacity: 0.8 }}>
                Macros + ingredients auto-extracted
              </div>
            </label>
          </div>
        )}

        {mode === "text" && (
          <div className="flex flex-col gap-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='e.g. "4 eggs scrambled, half avocado, slice of sourdough"'
              rows={4}
              autoFocus
              disabled={busy}
              className="w-full rounded-xl p-3 text-[14px] resize-none"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            />
            <button
              onClick={logText}
              disabled={busy || !text.trim()}
              className="w-full rounded-xl px-4 py-3 text-[14px]"
              style={{
                background: "var(--olive)",
                color: "#FBFAF6",
                fontWeight: 500,
                opacity: busy || !text.trim() ? 0.5 : 1,
              }}
            >
              {stage === "saving"
                ? "Estimating macros…"
                : "Log meal"}
            </button>
            <div
              className="text-[11px] leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              Claude estimates calories, protein, fat, carbs from your
              description. Be specific about portions for better accuracy.
            </div>
          </div>
        )}

        {err && (
          <div
            className="mt-3 text-[12px] p-2 rounded-lg"
            style={{ color: "var(--error)" }}
          >
            {err}
          </div>
        )}
      </div>
    </div>
  );
}
