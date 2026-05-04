"use client";

// CostStepper — inline cost editor with -/+ buttons and a tap-to-type
// number field. Designed for thumb-driven mobile edits in wishlist
// rows, item-edit forms, and Coach proposals where re-pricing should
// be a 2-second action, not a trip to a separate edit page.
//
// UX rules:
//   - Tap "-" / "+" to step. Step size scales with current value:
//     <$20 → $1, <$100 → $5, <$500 → $25, <$2000 → $50, else $100.
//     This makes a $4 supplement edit feel snappy AND a $2,400 device
//     adjust feel snappy, both with the same control.
//   - Tap the number itself to type a custom amount.
//   - Long-press on a stepper accelerates (held = repeat every 90ms).
//   - onChange fires after the user releases the button OR commits
//     the typed value (blur / Enter). Prevents thrashing the DB on
//     every tap during a held step.
//   - Empty value = null (cleared). User can clear via "x" button.

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";

type Props = {
  value: number | null;
  onChange: (next: number | null) => void;
  /** Min stays at 0 — negative cost makes no sense. */
  max?: number;
  /** Optional placeholder when value is null. */
  placeholder?: string;
  /** Visual size — "sm" for inline rows, "md" for forms. */
  size?: "sm" | "md";
  /** Hide the clear button (e.g. when nullable doesn't apply). */
  noClear?: boolean;
  /** Disabled state. */
  disabled?: boolean;
  /** Show the dollar sign before the number. Default true. */
  showCurrency?: boolean;
  className?: string;
};

function stepFor(v: number): number {
  if (v < 20) return 1;
  if (v < 100) return 5;
  if (v < 500) return 25;
  if (v < 2000) return 50;
  return 100;
}

export default function CostStepper({
  value,
  onChange,
  max = 99999,
  placeholder = "Cost",
  size = "sm",
  noClear = false,
  disabled = false,
  showCurrency = true,
  className = "",
}: Props) {
  // `value` is the source of truth — owned by the parent. We only hold
  // local state for the in-flight text being typed; everything else
  // reads from `value` directly so external updates (Coach proposals,
  // bulk resets, optimistic rollbacks) flow in without a sync useEffect.
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState<string>(
    value != null ? String(value) : "",
  );
  const accelTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Latest committed value lives in a ref so the held-button interval
  // can read it without re-binding on every render. We update the ref
  // in an effect (never during render) to comply with the strict hooks
  // rules in this project's eslint config.
  const latestValue = useRef<number | null>(value);
  useEffect(() => {
    latestValue.current = value;
  }, [value]);

  function commit(next: number | null) {
    onChange(next);
  }

  function step(direction: 1 | -1) {
    const cur = latestValue.current ?? 0;
    const s = stepFor(cur);
    const next = Math.min(max, Math.max(0, cur + direction * s));
    latestValue.current = next; // keep the ref in sync for the next interval tick
    commit(next);
  }

  function startAccel(direction: 1 | -1) {
    if (disabled) return;
    step(direction);
    if (accelTimer.current) clearInterval(accelTimer.current);
    accelTimer.current = setInterval(() => step(direction), 90);
  }
  function stopAccel() {
    if (accelTimer.current) {
      clearInterval(accelTimer.current);
      accelTimer.current = null;
    }
  }

  // Cleanup on unmount in case a held button never released.
  useEffect(() => {
    return () => {
      if (accelTimer.current) clearInterval(accelTimer.current);
    };
  }, []);

  const btnH = size === "md" ? 36 : 30;
  const btnW = size === "md" ? 36 : 30;
  const display =
    value != null && !editing ? `${showCurrency ? "$" : ""}${value}` : "";

  return (
    <div
      className={`inline-flex items-center gap-0 rounded-lg overflow-hidden ${className}`}
      style={{
        background: "var(--surface-alt)",
        border: "1px solid var(--border)",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <button
        type="button"
        onPointerDown={() => startAccel(-1)}
        onPointerUp={stopAccel}
        onPointerLeave={stopAccel}
        onPointerCancel={stopAccel}
        disabled={disabled || (value ?? 0) <= 0}
        className="flex items-center justify-center select-none"
        style={{
          width: btnW,
          height: btnH,
          color: "var(--foreground-soft)",
          fontSize: 18,
          fontWeight: 600,
        }}
        aria-label="Decrease"
      >
        −
      </button>

      <div
        className="flex-1 px-1 text-center tabular-nums select-none"
        style={{
          minWidth: size === "md" ? 70 : 56,
          fontSize: size === "md" ? 14 : 12.5,
          fontWeight: 600,
          color: value != null ? "var(--foreground)" : "var(--muted)",
        }}
      >
        {editing ? (
          <input
            type="number"
            min={0}
            max={max}
            step={1}
            value={text}
            autoFocus
            inputMode="numeric"
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              const n = parseFloat(text);
              if (!Number.isFinite(n) || n < 0) {
                commit(null);
                setText("");
              } else {
                const clamped = Math.min(max, Math.round(n));
                commit(clamped);
                setText(String(clamped));
              }
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setText(value != null ? String(value) : "");
                setEditing(false);
              }
            }}
            className="w-full text-center bg-transparent outline-none tabular-nums"
            style={{ fontSize: "inherit", fontWeight: "inherit" }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              if (disabled) return;
              setEditing(true);
              setText(value != null ? String(value) : "");
            }}
            className="w-full"
            style={{
              minHeight: btnH,
              fontSize: "inherit",
              fontWeight: "inherit",
              color: "inherit",
            }}
          >
            {display || placeholder}
          </button>
        )}
      </div>

      <button
        type="button"
        onPointerDown={() => startAccel(1)}
        onPointerUp={stopAccel}
        onPointerLeave={stopAccel}
        onPointerCancel={stopAccel}
        disabled={disabled || (value ?? 0) >= max}
        className="flex items-center justify-center select-none"
        style={{
          width: btnW,
          height: btnH,
          color: "var(--foreground-soft)",
          fontSize: 16,
          fontWeight: 600,
        }}
        aria-label="Increase"
      >
        +
      </button>

      {!noClear && value != null && !disabled && (
        <button
          type="button"
          onClick={() => {
            commit(null);
            setText("");
          }}
          className="flex items-center justify-center select-none"
          style={{
            width: btnW - 8,
            height: btnH,
            color: "var(--muted)",
            borderLeft: "1px solid var(--border)",
          }}
          aria-label="Clear cost"
        >
          <Icon name="plus" size={11} className="rotate-45" />
        </button>
      )}
    </div>
  );
}
