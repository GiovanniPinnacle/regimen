"use client";

// Client wrapper so BarList can take a currency formatter (function
// props can't cross from the server page).

import { BarList, type BarListRow } from "@/components/charts";

export default function CostBars({ rows }: { rows: BarListRow[] }) {
  return (
    <BarList
      rows={rows}
      format={(n) => `$${n >= 100 ? Math.round(n) : n.toFixed(n < 10 ? 2 : 0)}/mo`}
      ariaLabel="Monthly cost by item"
      emptyLabel="Add a price and days of supply to any item to see it here."
    />
  );
}
