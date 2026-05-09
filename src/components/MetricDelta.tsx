// MetricDelta — comparative chip for "X vs baseline." Use anywhere a
// number would otherwise hang in space without context. Premium apps
// always anchor a metric to either its goal, a previous period, or
// peer cohort — never just a naked number.
//
// Three positive/negative semantics:
//   - "good_higher" — increase is good (sleep score, adherence, protein)
//   - "good_lower"  — decrease is good (resting HR, body fat)
//   - "neutral"     — no value judgment (just informational delta)
//
// Renders as a small inline chip: arrow + delta + optional baseline label.

import Icon from "@/components/Icon";

type Direction = "good_higher" | "good_lower" | "neutral";

type Props = {
  /** The signed delta. Positive = "above baseline", negative = "below". */
  delta: number;
  /** What the baseline is — shown as the trailing context label.
   *  Examples: "vs 7d avg", "vs target", "vs yesterday". */
  baseline?: string;
  /** Whether higher / lower is the desired direction. Drives color. */
  direction?: Direction;
  /** Optional unit suffix on the delta number itself ("g", "%", "lbs"). */
  unit?: string;
  /** Pixel size of the inline arrow. */
  iconSize?: number;
  /** When delta = 0, hide the chip entirely. Default true — "no change"
   *  is rarely worth screen space. */
  hideOnZero?: boolean;
};

export default function MetricDelta({
  delta,
  baseline,
  direction = "good_higher",
  unit,
  iconSize = 11,
  hideOnZero = true,
}: Props) {
  if (hideOnZero && Math.abs(delta) < 0.0001) return null;

  const isPositive = delta > 0;
  // Map signed-delta to color via direction semantics.
  const isGood =
    direction === "neutral"
      ? null
      : direction === "good_higher"
        ? isPositive
        : !isPositive;

  const color =
    isGood == null
      ? "var(--muted)"
      : isGood
        ? "var(--accent)"
        : "var(--warn)";

  const tintBg =
    isGood == null
      ? "var(--surface-alt)"
      : isGood
        ? "var(--accent-tint)"
        : "rgba(232, 181, 71, 0.12)";

  // Round to 1 decimal for non-integer deltas, drop trailing zeros.
  const formatted = (() => {
    const abs = Math.abs(delta);
    if (abs >= 10 || Math.round(abs) === abs) {
      return Math.round(abs).toString();
    }
    return abs.toFixed(1).replace(/\.0$/, "");
  })();

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded-full text-[10.5px] tabular-nums"
      style={{
        background: tintBg,
        color,
        fontWeight: 700,
        letterSpacing: "-0.005em",
      }}
    >
      <Icon
        name={isPositive ? "arrow-up" : "arrow-down"}
        size={iconSize}
        strokeWidth={2.2}
      />
      <span>
        {formatted}
        {unit ?? ""}
      </span>
      {baseline && (
        <span style={{ opacity: 0.78, fontWeight: 600 }}>{baseline}</span>
      )}
    </span>
  );
}
