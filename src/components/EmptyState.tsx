// Empty state primitive — replaces bare "No items" text with a centered
// composition that has personality and clear next-action.

import Link from "next/link";

type CTA = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type Props = {
  /** Optional decorative emoji or React node (an SVG, etc.). Render large. */
  icon?: React.ReactNode;
  title: string;
  body?: string;
  primary?: CTA;
  secondary?: CTA;
  /** Layout: "card" wraps in a card-glass surface; "bare" renders inline. */
  variant?: "card" | "bare";
};

export default function EmptyState({
  icon,
  title,
  body,
  primary,
  secondary,
  variant = "card",
}: Props) {
  const inner = (
    <div className="text-center py-6 px-4 max-w-sm mx-auto">
      {icon && (
        <div
          className="mb-3 mx-auto opacity-60"
          style={{ fontSize: "44px", lineHeight: 1 }}
          aria-hidden
        >
          {icon}
        </div>
      )}
      <div
        className="text-[15px] mb-1"
        style={{ fontWeight: 500 }}
      >
        {title}
      </div>
      {body && (
        <div
          className="text-[13px] leading-relaxed mt-1.5 mb-5"
          style={{ color: "var(--muted)" }}
        >
          {body}
        </div>
      )}
      {(primary || secondary) && (
        <div className="flex flex-wrap justify-center gap-2 mt-2">
          {primary &&
            (primary.href ? (
              <Link
                href={primary.href}
                className="text-[13px] px-4 py-2 rounded-xl"
                style={{
                  background: "var(--olive)",
                  color: "#FBFAF6",
                  fontWeight: 500,
                }}
              >
                {primary.label}
              </Link>
            ) : (
              <button
                onClick={primary.onClick}
                className="text-[13px] px-4 py-2 rounded-xl"
                style={{
                  background: "var(--olive)",
                  color: "#FBFAF6",
                  fontWeight: 500,
                }}
              >
                {primary.label}
              </button>
            ))}
          {secondary &&
            (secondary.href ? (
              <Link
                href={secondary.href}
                className="text-[13px] px-4 py-2 rounded-xl border-hair"
                style={{ color: "var(--muted)" }}
              >
                {secondary.label}
              </Link>
            ) : (
              <button
                onClick={secondary.onClick}
                className="text-[13px] px-4 py-2 rounded-xl border-hair"
                style={{ color: "var(--muted)" }}
              >
                {secondary.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );

  if (variant === "card") {
    return <div className="rounded-2xl card-glass">{inner}</div>;
  }
  return inner;
}
