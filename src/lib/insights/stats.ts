// Small, dependency-free statistics used by the insight functions.
// Everything here is n=1 self-tracking math: we report effect sizes and
// sample sizes honestly and never claim causation.

export type Summary = {
  /** Arithmetic mean, null when n = 0. */
  mean: number | null;
  n: number;
  /** Sample standard deviation, null when n < 2. */
  sd: number | null;
};

export function summarize(values: ReadonlyArray<number>): Summary {
  const vals = values.filter((v) => Number.isFinite(v));
  const n = vals.length;
  if (n === 0) return { mean: null, n: 0, sd: null };
  const mean = vals.reduce((s, v) => s + v, 0) / n;
  if (n < 2) return { mean, n, sd: null };
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  return { mean, n, sd: Math.sqrt(variance) };
}

/** Cohen's d for (b − a) using the pooled SD. null when either side is
 *  too small or there's no spread at all. */
export function cohensD(a: Summary, b: Summary): number | null {
  if (a.mean == null || b.mean == null || a.sd == null || b.sd == null) return null;
  const pooledVar =
    ((a.n - 1) * a.sd ** 2 + (b.n - 1) * b.sd ** 2) / (a.n + b.n - 2);
  if (!(pooledVar > 0)) return null;
  return (b.mean - a.mean) / Math.sqrt(pooledVar);
}

/** Welch's t statistic for (b − a). null when it can't be computed. */
export function welchT(a: Summary, b: Summary): number | null {
  if (a.mean == null || b.mean == null || a.sd == null || b.sd == null) return null;
  const se = Math.sqrt(a.sd ** 2 / a.n + b.sd ** 2 / b.n);
  if (!(se > 0)) return null;
  return (b.mean - a.mean) / se;
}

/** Pearson correlation. null with < 3 pairs or zero variance. */
export function pearson(xs: ReadonlyArray<number>, ys: ReadonlyArray<number>): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

/**
 * How much to trust a two-group comparison.
 *  - insufficient: fewer than 7 points on a side — don't show a verdict.
 *  - early:        7–13 on the smaller side — show it, labelled "early read".
 *  - weak:         enough data, but the groups overlap (|t| < 2).
 *  - moderate:     |t| ≥ 2.
 *  - strong:       |t| ≥ 2.5 and a medium-or-larger effect (|d| ≥ 0.5).
 */
export type Confidence = "insufficient" | "early" | "weak" | "moderate" | "strong";

export const MIN_N = 7;
export const SOLID_N = 14;

export function confidenceFor(
  nA: number,
  nB: number,
  d: number | null,
  t: number | null,
): Confidence {
  const nMin = Math.min(nA, nB);
  if (nMin < MIN_N) return "insufficient";
  if (nMin < SOLID_N) return "early";
  const at = Math.abs(t ?? 0);
  const ad = Math.abs(d ?? 0);
  if (at >= 2.5 && ad >= 0.5) return "strong";
  if (at >= 2) return "moderate";
  return "weak";
}

/** Short human label, always carrying n. */
export function confidenceLabel(c: Confidence, nA: number, nB: number): string {
  const nText = nA === nB ? `n=${nA}` : `n=${nA} vs ${nB}`;
  switch (c) {
    case "insufficient":
      return `Not enough data yet · ${nText}`;
    case "early":
      return `Early read · ${nText}`;
    case "weak":
      return `No clear difference · ${nText}`;
    case "moderate":
      return `Moderate signal · ${nText}`;
    case "strong":
      return `Clear signal · ${nText}`;
  }
}

/** Rank for sorting (higher = more trustworthy). */
export function confidenceRank(c: Confidence): number {
  return { insufficient: 0, early: 1, weak: 2, moderate: 3, strong: 4 }[c];
}
