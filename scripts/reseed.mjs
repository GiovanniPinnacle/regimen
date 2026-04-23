// One-shot script to wipe + re-seed a user's items.
// Usage: node --experimental-strip-types scripts/reseed.mjs <USER_ID>
// Reads keys from .env.local

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import {
  SEED_ITEMS,
  QUEUED_ITEMS,
  BACKBURNER_ITEMS,
} from "../src/lib/seed.ts";

// Load .env.local
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const USER_ID = process.argv[2];
if (!USER_ID) {
  console.error("Usage: node --experimental-strip-types scripts/reseed.mjs <USER_ID>");
  process.exit(1);
}

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

console.log(`Wiping items for user ${USER_ID}...`);
await admin.from("stack_log").delete().eq("user_id", USER_ID);
await admin.from("symptom_log").delete().eq("user_id", USER_ID);
await admin.from("items").delete().eq("user_id", USER_ID);

const all = [...SEED_ITEMS, ...QUEUED_ITEMS, ...BACKBURNER_ITEMS];
const rows = all.map((i) => ({
  user_id: USER_ID,
  seed_id: i.seed_id ?? i.id,
  name: i.name,
  brand: i.brand ?? null,
  dose: i.dose ?? null,
  unit: i.unit ?? null,
  timing_slot: i.timing_slot,
  schedule_rule: i.schedule_rule,
  category: i.category,
  item_type: i.item_type,
  goals: i.goals,
  started_on: i.started_on ?? null,
  ends_on: i.ends_on ?? null,
  review_trigger: i.review_trigger ?? null,
  status: i.status,
  notes: i.notes ?? null,
  purchase_url: i.purchase_url ?? null,
}));

const { error } = await admin.from("items").insert(rows);
if (error) {
  console.error("Insert error:", error);
  process.exit(1);
}

console.log(`✓ Inserted ${rows.length} items for ${USER_ID}`);
