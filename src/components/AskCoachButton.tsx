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
          minHeight: 40,
          gap: 6,
        }
      : { fontSize: 12.5, padding: "9px 14px", minHeight: 36, gap: 6 };
  return (
    <button
      onClick={fire}
      className="inline-flex items-center justify-center rounded-xl no-truncate"
      style={{
        background:
          "linear-gradient(135deg, var(--pro) 0%, var(--pro-deep) 100%)",
        color: "#FFFFFF",
        fontWeight: 700,
        boxShadow:
          "0 4px 14px rgba(139, 124, 252, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.18)",
        whiteSpace: "nowrap",
        flexShrink: 0,
        ...styles,
      }}
    >
      <Icon
        name="sparkle"
        size={size === "md" ? 13 : 12}
        strokeWidth={2.4}
      />
      {label}
    </button>
  );
}
