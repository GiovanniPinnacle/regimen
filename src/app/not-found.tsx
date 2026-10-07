// app/not-found.tsx — friendly 404 page.
//
// Brief message + a single CTA back to /today. No Coach prompts, no
// secondary actions.

import Card from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="py-16 max-w-md mx-auto">
      <Card padding="xl" className="text-center">
        <div className="text-display tabular-nums text-[var(--muted)]">404</div>
        <h1 className="text-title-3 mt-3 mb-2 text-[var(--foreground)]">
          That page doesn&apos;t exist
        </h1>
        <p className="text-footnote mb-5 text-[var(--muted)]">
          Maybe a link went stale, or the URL is mistyped. Head back to
          Today and you&apos;re right where you should be.
        </p>
        <ButtonLink href="/today" variant="primary">
          Back to Today
        </ButtonLink>
      </Card>
    </div>
  );
}
