"use client";

// AskCoachButton — small consistent "Ask Coach" CTA for tab headers
// (/stack, /fuel, /train) and section headers. Fires Coach with a
// pre-built prompt scoped to the surface, so the user gets a Coach
// conversation that already knows the context.
//
// Why a shared component: the user wants Coach prominent across the
// app — primary lever for refining the regimen, making decisions,
// communicating. Same pill style everywhere = recognizable affordance.

import Icon from "@/components/Icon";

type Props = {
  /** The prompt that fires when tapped. Should be a complete instruction
   *  ending with a clear ask. */
  prompt: string;
  /** Send immediately vs pre-fill the input. Default = pre-fill so
   *  the user can append context before tapping send. */
  send?: boolean;
  /** Visual size — "sm" for header inline, "md" for section CTA. */
  size?: "sm" | "md";
  /** Override label. Default: "Ask Coach". */
  label?: string;
};

export default function AskCoachButton({
  prompt,
  send = false,
  size = "sm",
  label = "Ask Coach",
}: Props) {
  function fire() {
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: prompt, send },
      }),
    );
  }
  const styles =
    size === "md"
      ? {
          fontSize: 13,
          padding: "10px 14px",
          minHeight: 38,
          gap: 6,
        }
      : { fontSize: 12, padding: "8px 12px", minHeight: 34, gap: 5 };
  return (
    <button
      onClick={fire}
      className="inline-flex items-center rounded-xl"
      style={{
        background:
          "linear-gradient(135deg, var(--pro) 0%, #6D28D9 100%)",
        color: "#FBFAF6",
        fontWeight: 700,
        boxShadow: "0 4px 14px rgba(168, 85, 247, 0.30)",
        ...styles,
      }}
    >
      <Icon
        name="sparkle"
        size={size === "md" ? 13 : 11}
        strokeWidth={2.4}
      />
      {label}
    </button>
  );
}
