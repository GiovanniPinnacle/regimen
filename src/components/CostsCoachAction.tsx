"use client";

// Client-only Coach trigger inside the Costs hero card. Fires Coach with a
// focused cost-cut prompt that returns proposals without losing efficacy.

import Icon from "@/components/Icon";

export default function CostsCoachAction({
  monthlyTotal,
}: {
  monthlyTotal: number;
}) {
  function fire() {
    const dollars = (monthlyTotal / 100).toFixed(2);
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: {
          text:
            `My monthly stack cost is $${dollars}. Find me 2-3 swaps that could cut cost by 20%+ WITHOUT losing efficacy. ` +
            `Cite mechanism not brand. Emit each swap as a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format.`,
          send: true,
        },
      }),
    );
  }

  return (
    <button
      onClick={fire}
      className="w-full mt-4 py-2.5 rounded-xl text-[13px] flex items-center justify-center gap-1.5"
      style={{
        background: "rgba(251, 250, 246, 0.96)",
        color: "var(--premium-deep)",
        fontWeight: 700,
      }}
    >
      <Icon name="sparkle" size={13} strokeWidth={2.2} />
      Have Coach cut my costs
    </button>
  );
}
