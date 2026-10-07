"use client";

// EmptyToday — shown on /today when there are no active items.
//
// Also the first-run gate for the 6-digit-code sign-in path (which skips
// /auth/callback): if this user hasn't been through onboarding and has
// nothing on Today, send them to /onboard instead.
//
// One clear path: a starter pack for their focus, added ACTIVE in one tap.
// Secondary: search or scan for what they already take.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EmptyGlyph from "@/components/EmptyGlyph";
import StarterPack from "@/components/StarterPack";
import Button, { ButtonLink } from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import SearchAdd from "@/app/onboard/_components/SearchAdd";
import { packsForFocus, type StarterPack as Pack } from "@/lib/onboarding/packs";
import type { OnboardingState } from "@/lib/onboarding/state";

export default function EmptyToday({
  displayName,
}: {
  displayName?: string | null;
}) {
  const router = useRouter();
  const [pack, setPack] = useState<Pack | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      let focus: string[] = [];
      try {
        const res = await fetch("/api/onboarding", { cache: "no-store" });
        if (res.ok) {
          const s = (await res.json()) as OnboardingState;
          if (s.needsOnboarding) {
            router.replace("/onboard");
            return;
          }
          focus = s.focus;
        }
      } catch {
        // Offline or API hiccup — still show the generic pack.
      }
      if (alive) setPack(packsForFocus(focus)[0]);
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  if (!pack) {
    return (
      <div className="mx-auto max-w-md pt-4" aria-busy>
        <div className="skeleton-card h-64" />
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-md pb-12">
      <div className="mb-6 pt-2 text-center">
        <div className="mb-4 flex justify-center">
          <EmptyGlyph icon="check-circle" tone="muted" size={60} />
        </div>
        <h2 className="text-title-2">
          {displayName ? `${displayName}, your Today is empty` : "Your Today is empty"}
        </h2>
        <p className="mt-1.5 text-callout text-[var(--foreground-soft)]">
          Start with a pack in one tap, or add what you already take.
          Everything shows up here as a checklist.
        </p>
      </div>

      <StarterPack pack={pack} primary />

      <div className="mt-3">
        <Button
          variant="ghost"
          size="md"
          fullWidth
          icon="search"
          onClick={() => setSearchOpen(true)}
        >
          Search or scan instead
        </Button>
      </div>

      <Sheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Add what you take"
        description="Search, or scan a label. Items go straight onto Today."
        footer={
          <ButtonLink href="/scan" variant="secondary" size="md" fullWidth icon="camera">
            Scan a label
          </ButtonLink>
        }
      >
        <div className="min-h-[240px]">
          <SearchAdd autoFocus onAdded={() => setSearchOpen(false)} />
        </div>
      </Sheet>
    </section>
  );
}
