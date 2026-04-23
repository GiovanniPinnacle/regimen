// Server-side seed sync. Runs on every sign-in.
// IDEMPOTENT: only inserts seed items the user doesn't already have (matched by seed_id).
// Safe to re-run. Expands as we add new seed items over time.

import { createAdminClient } from "@/lib/supabase/admin";
import { SEED_ITEMS, QUEUED_ITEMS, BACKBURNER_ITEMS } from "@/lib/seed";
import type { Item } from "@/lib/types";

type DbInsert = Omit<Item, "id" | "created_at" | "user_id"> & {
  user_id: string;
};

function toDbRow(item: Item, user_id: string): DbInsert {
  return {
    user_id,
    seed_id: item.seed_id ?? item.id,
    name: item.name,
    brand: item.brand,
    dose: item.dose,
    unit: item.unit,
    timing_slot: item.timing_slot,
    schedule_rule: item.schedule_rule,
    category: item.category,
    item_type: item.item_type,
    goals: item.goals,
    started_on: item.started_on,
    ends_on: item.ends_on,
    review_trigger: item.review_trigger,
    status: item.status,
    notes: item.notes,
    purchase_url: item.purchase_url,
  };
}

/**
 * Ensure every seed item exists for this user. Inserts only the missing ones.
 * Legacy name: seedUserIfEmpty — kept as an alias for backwards compat.
 */
export async function syncSeed(user_id: string): Promise<number> {
  const admin = createAdminClient();

  // Fetch the set of seed_ids this user already has
  const { data: existing, error: fetchErr } = await admin
    .from("items")
    .select("seed_id")
    .eq("user_id", user_id)
    .not("seed_id", "is", null);

  if (fetchErr) {
    console.error("syncSeed fetch error", fetchErr);
    return 0;
  }

  const have = new Set<string>(
    (existing ?? []).map((r) => r.seed_id as string).filter(Boolean),
  );

  const allSeeds: Item[] = [
    ...SEED_ITEMS,
    ...QUEUED_ITEMS,
    ...BACKBURNER_ITEMS,
  ];

  const toInsert = allSeeds.filter(
    (s) => s.seed_id && !have.has(s.seed_id),
  );

  if (toInsert.length === 0) return 0;

  const rows = toInsert.map((i) => toDbRow(i, user_id));
  const { error } = await admin.from("items").insert(rows);
  if (error) {
    console.error("syncSeed insert error", error);
    throw error;
  }
  return rows.length;
}

// Backwards compat for existing import paths
export const seedUserIfEmpty = syncSeed;
