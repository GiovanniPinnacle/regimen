"use client";

// WasteCandidates — surfaces items the user is paying for but barely
// taking. The single highest-leverage dollar move in the cost view.
//
// Each row:
//   - Item name
//   - Monthly cost + adherence rate
//   - Annualized waste figure (the $$$ saved if dropped)
//   - "Drop?" → fires Coach with a focused prompt
//   - "Reframe" → fires Coach to find a way to make it stick
//
// Clicking "Drop?" doesn't auto-retire — Coach emits a proposal so the
// user gets a chance to confirm + see the reasoning before committing.

import Icon from "@/components/Icon";
import { formatUSD } from "@/lib/cost";

type Candidate = {
  item_id: string;
  item_name: string;
  monthly_cost: number;
  adherence_rate: number;
  taken_count: number;
  total_count: number;
  annualized_waste: number;
};

export default function WasteCandidates({
  candidates,
}: {
  candidates: Candidate[];
}) {
  if (candidates.length === 0) return null;

  const totalAnnualWaste = candidates.reduce(
    (s, c) => s + c.annualized_waste,
    0,
  );

  function fireDrop(c: Candidate) {
    const prompt = `Coach — I've been taking ${c.item_name} ${c.taken_count}/${c.total_count} times in the last 30 days (${Math.round(c.adherence_rate * 100)}% adherence) at ${formatUSD(c.monthly_cost)}/month. That's ${formatUSD(c.annualized_waste)}/year in waste. Decide: should I drop it, or is there a tighter version (different timing, lower dose, swap brand) that would actually stick? Emit ONE proposal in <<<PROPOSAL ... PROPOSAL>>> format with action: retire OR action: adjust depending on your call. Keep reasoning to one sentence.`;
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: prompt, send: true },
      }),
    );
  }

  function fireReframe(c: Candidate) {
    // Pre-fill, don't auto-send — user can append context before
    // sending (e.g. "I'm not actually trying to take it daily").
    const prompt = `${c.item_name} is only at ${Math.round(c.adherence_rate * 100)}% adherence (${c.taken_count}/${c.total_count} in 30d) but I'm paying ${formatUSD(c.monthly_cost)}/mo. Without dropping it, what's the SINGLE smallest behavior change that would push adherence above 80%? Look at my recent skip reasons + what's in the same slot.`;
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: prompt },
      }),
    );
  }

  return (
    <section className="mb-6">
      <div className="flex items-baseline justify-between mb-2.5 px-0.5">
        <h2
          className="text-[11px] uppercase tracking-wider"
          style={{
            color: "var(--error)",
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          Likely waste · {candidates.length}
        </h2>
        <span
          className="text-[11px] tabular-nums"
          style={{ color: "var(--muted)" }}
        >
          ~{formatUSD(totalAnnualWaste)}/yr
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {candidates.map((c) => (
          <div
            key={c.item_id}
            className="rounded-2xl card-glass p-3.5"
            style={{ borderColor: "rgba(239, 68, 68, 0.30)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div
                  className="text-[14px] leading-snug"
                  style={{ fontWeight: 600 }}
                >
                  {c.item_name}
                </div>
                <div
                  className="text-[12px] mt-1 leading-relaxed flex items-center gap-2 flex-wrap"
                  style={{ color: "var(--muted)" }}
                >
                  <span>
                    <strong style={{ color: "var(--foreground)" }}>
                      {Math.round(c.adherence_rate * 100)}%
                    </strong>{" "}
                    adherence ({c.taken_count}/{c.total_count})
                  </span>
                  <span aria-hidden style={{ color: "var(--border)" }}>
                    ·
                  </span>
                  <span>
                    <strong style={{ color: "var(--foreground)" }}>
                      {formatUSD(c.monthly_cost)}
                    </strong>
                    /mo
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div
                  className="text-[10px] uppercase tracking-wider"
                  style={{
                    color: "var(--error)",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                  }}
                >
                  Annual waste
                </div>
                <div
                  className="text-[15px] tabular-nums leading-none mt-0.5"
                  style={{ fontWeight: 700, color: "var(--error)" }}
                >
                  {formatUSD(c.annualized_waste)}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => fireDrop(c)}
                className="flex-1 text-[12.5px] px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5"
                style={{
                  background: "var(--error)",
                  color: "#FBFAF6",
                  fontWeight: 700,
                }}
              >
                <Icon name="trash" size={12} strokeWidth={2.2} />
                Drop?
              </button>
              <button
                onClick={() => fireReframe(c)}
                className="flex-1 text-[12.5px] px-3 py-1.5 rounded-lg"
                style={{
                  background: "var(--surface-alt)",
                  color: "var(--foreground-soft)",
                  fontWeight: 600,
                }}
              >
                Make it stick
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
