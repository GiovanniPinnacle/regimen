// Server-side seed. Runs once per user on first sign-in.
// Uses the admin (service_role) client to insert on the user's behalf,
// stamping each row with their user_id.

import { createAdminClient } from "@/lib/supabase/admin";
import { SEED_ITEMS, QUEUED_ITEMS, BACKBURNER_ITEMS } from "@/lib/seed";
import type { Item } from "@/lib/types";

type DbItem = Omit<Item, "id" | "created_at"> & {
  user_id: string;
};

function toDbItem(item: Item, user_id: string): DbItem {
  return {
    user_id,
    name: item.name,
    brand: item.brand,
    dose: item.dose,
    unit: item.unit,
    timing_slot: item.timing_slot,
    schedule_rule: item.schedule_rule,
    category: item.category,
    goals: item.goals,
    started_on: item.started_on,
    ends_on: item.ends_on,
    review_trigger: item.review_trigger,
    status: item.status,
    notes: item.notes,
    purchase_url: item.purchase_url,
  };
}

export async function seedUserIfEmpty(user_id: string): Promise<void> {
  const admin = createAdminClient();

  // Count existing items for this user
  const { count, error: countError } = await admin
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user_id);

  if (countError) {
    console.error("seedUserIfEmpty count error", countError);
    return;
  }

  if ((count ?? 0) > 0) {
    // Already seeded — no-op
    return;
  }

  const rows: DbItem[] = [
    ...SEED_ITEMS.map((i) => toDbItem(i, user_id)),
    ...QUEUED_ITEMS.map((i) => toDbItem(i, user_id)),
    ...BACKBURNER_ITEMS.map((i) => toDbItem(i, user_id)),
  ];

  const { error } = await admin.from("items").insert(rows);
  if (error) {
    console.error("seedUserIfEmpty insert error", error);
    throw error;
  }
}
