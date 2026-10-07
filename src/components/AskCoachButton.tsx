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
  /** Full width (md size becomes a block CTA). */
  fullWidth?: boolean;
};

export default function AskCoachButton({
  prompt,
  send = false,
  size = "sm",
  label = "Ask Coach",
  fullWidth = false,
}: Props) {
  function fire() {
    window.dispatchEvent(
      new CustomEvent("regimen:ask", {
        detail: { text: prompt, send },
      }),
    );
  }
  // md is the page-section CTA size (Refine stack on /stack, etc).
  // It defaults to full-width on its row when used as a hero CTA.
  const isBlock = size === "md" || fullWidth;
  const styles =
    size === "md"
      ? {
          fontSize: 15,
          padding: "13px 18px",
          minHeight: 48,
          gap: 8,
          letterSpacing: "-0.01em",
        }
      : {
          fontSize: 13,
          padding: "10px 14px",
          minHeight: 44,
          gap: 6,
          letterSpacing: "-0.005em",
        };
  return (
    <button
      onClick={fire}
      className={`${isBlock ? "flex w-full" : "inline-flex"} items-center justify-center rounded-[14px] no-truncate bg-[var(--coach-fill)] text-white transition-[transform,background-color] duration-150 hover:bg-[var(--pro)] active:scale-[0.97]`}
      style={{
        fontWeight: 600,
        whiteSpace: "nowrap",
        flexShrink: 0,
        ...styles,
      }}
    >
      <Icon
        name="sparkle"
        size={size === "md" ? 15 : 13}
        strokeWidth={2.4}
      />
      {label}
    </button>
  );
}
