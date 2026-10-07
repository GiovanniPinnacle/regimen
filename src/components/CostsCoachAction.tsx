"use client";

// Coach trigger on /costs: asks for swaps that cut cost without losing
// efficacy. monthlyTotal is in dollars.

import Button from "@/components/ui/Button";
import { openCoach } from "@/lib/coach-events";

export default function CostsCoachAction({
  monthlyTotal,
}: {
  monthlyTotal: number;
}) {
  return (
    <Button
      variant="coach"
      icon="sparkle"
      fullWidth
      onClick={() =>
        openCoach({
          text:
            `My stack costs about $${monthlyTotal.toFixed(0)} a month. Find 2-3 swaps that cut that by 20% or more without losing efficacy. ` +
            `Cite mechanism, not brand. Emit each swap as a one-tap proposal in <<<PROPOSAL ... PROPOSAL>>> format.`,
          send: true,
        })
      }
    >
      Find savings with Coach
    </Button>
  );
}
