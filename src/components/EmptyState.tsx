// Empty state primitive — centered glyph, title, one line of help and up
// to two actions. Built on the shared Card / Button primitives.

import type { ReactNode } from "react";
import type { IconName } from "@/components/Icon";
import EmptyGlyph from "@/components/EmptyGlyph";
import Card from "@/components/ui/Card";
import Button, { ButtonLink } from "@/components/ui/Button";

type CTA = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type Props = {
  /** Preferred: an icon from the shared set. */
  glyph?: IconName;
  /** Legacy: older callers pass an emoji. Known ones map to icons; any
   *  other node renders as-is. */
  icon?: ReactNode;
  title: string;
  body?: string;
  primary?: CTA;
  secondary?: CTA;
  /** "card" wraps in a Card surface; "bare" renders inline. */
  variant?: "card" | "bare";
};

const EMOJI_TO_ICON: Record<string, IconName> = {
  "🔎": "search",
  "🔍": "search",
  "🚫": "ban",
  "🎯": "target",
  "📋": "list-ordered",
};

function Action({ cta, kind }: { cta: CTA; kind: "primary" | "secondary" }) {
  const variant = kind === "primary" ? "primary" : "secondary";
  return cta.href ? (
    <ButtonLink href={cta.href} variant={variant} size="md">
      {cta.label}
    </ButtonLink>
  ) : (
    <Button onClick={cta.onClick} variant={variant} size="md">
      {cta.label}
    </Button>
  );
}

export default function EmptyState({
  glyph,
  icon,
  title,
  body,
  primary,
  secondary,
  variant = "card",
}: Props) {
  const mapped =
    glyph ?? (typeof icon === "string" ? EMOJI_TO_ICON[icon] : undefined);

  const inner = (
    <div className="mx-auto max-w-sm px-4 py-6 text-center">
      {mapped ? (
        <div className="mb-3 flex justify-center">
          <EmptyGlyph icon={mapped} tone="muted" size={56} />
        </div>
      ) : icon ? (
        <div className="mb-3 text-[40px] leading-none opacity-60" aria-hidden>
          {icon}
        </div>
      ) : null}
      <div className="text-body font-semibold">{title}</div>
      {body && (
        <p className="mt-1.5 text-footnote text-[var(--muted)]">{body}</p>
      )}
      {(primary || secondary) && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {primary && <Action cta={primary} kind="primary" />}
          {secondary && <Action cta={secondary} kind="secondary" />}
        </div>
      )}
    </div>
  );

  if (variant === "card") return <Card padding="none">{inner}</Card>;
  return inner;
}
