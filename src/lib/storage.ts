// Supabase-backed data layer.
// Uses the browser client — RLS ensures each user sees only their own rows.
// Interface is async and mirrors the previous localStorage version
// so components didn't need to change.

"use client";

import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/constants";
import type {
  ChangelogEntry,
  Item,
  ItemReaction,
  ReactionType,
  StackLogEntry,
  SymptomLog,
} from "./types";

function supa() {
  return createClient();
}

// ---------- Items ----------
export async function getAllItems(): Promise<Item[]> {
  const { data, error } = await supa()
    .from("items")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getAllItems", error);
    return [];
  }
  return (data ?? []) as Item[];
}

export async function getItemsByStatus(
  status: Item["status"],
): Promise<Item[]> {
  const { data, error } = await supa()
    .from("items")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getItemsByStatus", error);
    return [];
  }
  return (data ?? []) as Item[];
}

export async function getItem(id: string): Promise<Item | null> {
  const { data, error } = await supa()
    .from("items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getItem", error);
    return null;
  }
  return data as Item | null;
}

export async function upsertItem(item: Item): Promise<void> {
  const { error } = await supa().from("items").upsert(item);
  if (error) console.error("upsertItem", error);
}

// ---------- Stack log (daily check-offs) ----------
export async function getStackLog(date: string): Promise<StackLogEntry[]> {
  const { data, error } = await supa()
    .from("stack_log")
    .select("*")
    .eq("date", date);
  if (error) {
    console.error("getStackLog", error);
    return [];
  }
  return (data ?? []) as unknown as StackLogEntry[];
}

export async function getTakenMap(
  date: string,
): Promise<Record<string, boolean>> {
  const entries = await getStackLog(date);
  const map: Record<string, boolean> = {};
  for (const e of entries) map[e.item_id] = e.taken;
  return map;
}

export async function toggleTaken(
  date: string,
  itemId: string,
): Promise<boolean> {
  const client = supa();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return false;

  // Check current state
  const { data: existing } = await client
    .from("stack_log")
    .select("id,taken")
    .eq("date", date)
    .eq("item_id", itemId)
    .maybeSingle();

  if (existing) {
    const newTaken = !existing.taken;
    const { error } = await client
      .from("stack_log")
      .update({
        taken: newTaken,
        skipped_reason: newTaken ? null : (existing as { skipped_reason?: string }).skipped_reason ?? null,
        logged_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) console.error("toggleTaken update", error);
    return newTaken;
  } else {
    const { error } = await client.from("stack_log").insert({
      user_id: user.id,
      date,
      item_id: itemId,
      taken: true,
      logged_at: new Date().toISOString(),
    });
    if (error) console.error("toggleTaken insert", error);
    return true;
  }
}

// Mark a food item as "ate something else instead." Records what was
// actually eaten so Claude has real food data, not idealized.
export async function logSwap(
  date: string,
  itemId: string,
  whatYouAte: string,
): Promise<void> {
  // Reuse stack_log.skipped_reason with a "Swapped: " prefix so it's
  // distinguishable from regular skips. Claude parses this in context.ts.
  await logSkip(date, itemId, `Swapped: ${whatYouAte}`);
}

// Mark an item as explicitly skipped today, with a reason.
// Different semantics from "untaken" — captures *why* and surfaces patterns.
export async function logSkip(
  date: string,
  itemId: string,
  reason: string,
): Promise<void> {
  const client = supa();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return;

  const { data: existing } = await client
    .from("stack_log")
    .select("id")
    .eq("date", date)
    .eq("item_id", itemId)
    .maybeSingle();

  const row = {
    user_id: user.id,
    date,
    item_id: itemId,
    taken: false,
    skipped_reason: reason,
    logged_at: new Date().toISOString(),
  };
  if (existing) {
    const { error } = await client
      .from("stack_log")
      .update(row)
      .eq("id", existing.id);
    if (error) console.error("logSkip update", error);
  } else {
    const { error } = await client.from("stack_log").insert(row);
    if (error) console.error("logSkip insert", error);
  }
}

// Get full stack log for a date (with skipped reasons)
export async function getStackLogDetailed(
  date: string,
): Promise<
  {
    id: string;
    item_id: string;
    taken: boolean;
    skipped_reason?: string | null;
    logged_at: string;
  }[]
> {
  const { data, error } = await supa()
    .from("stack_log")
    .select("id, item_id, taken, skipped_reason, logged_at")
    .eq("date", date);
  if (error) {
    console.error("getStackLogDetailed", error);
    return [];
  }
  return (data ?? []) as {
    id: string;
    item_id: string;
    taken: boolean;
    skipped_reason?: string | null;
    logged_at: string;
  }[];
}

// ---------- Symptom log ----------
export async function getSymptomLog(
  date: string,
): Promise<SymptomLog | null> {
  const { data, error } = await supa()
    .from("symptom_log")
    .select("*")
    .eq("date", date)
    .maybeSingle();
  if (error) {
    console.error("getSymptomLog", error);
    return null;
  }
  return data as SymptomLog | null;
}

export async function saveSymptomLog(log: SymptomLog): Promise<void> {
  const client = supa();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return;
  const { error } = await client.from("symptom_log").upsert(
    {
      user_id: user.id,
      date: log.date,
      feel_score: log.feel_score,
      sleep_quality: log.sleep_quality,
      seb_derm_score: log.seb_derm_score,
      stress: log.stress,
      energy_pm: log.energy_pm,
      notes: log.notes,
    },
    { onConflict: "user_id,date" },
  );
  if (error) console.error("saveSymptomLog", error);
}

export async function getRecentSymptomLogs(
  days: number,
): Promise<SymptomLog[]> {
  const { data, error } = await supa()
    .from("symptom_log")
    .select("*")
    .order("date", { ascending: false })
    .limit(days);
  if (error) {
    console.error("getRecentSymptomLogs", error);
    return [];
  }
  return (data ?? []) as SymptomLog[];
}

// ---------- Oura ----------
export async function getOuraToday(date: string): Promise<{
  wake_time?: string | null;
  readiness?: number | null;
  hrv?: number | null;
  rhr?: number | null;
  sleep_score?: number | null;
  total_sleep_min?: number | null;
  temp_deviation?: number | null;
} | null> {
  const { data, error } = await supa()
    .from("oura_daily")
    .select("*")
    .eq("date", date)
    .maybeSingle();
  if (error) return null;
  return data as typeof data & { wake_time?: string | null };
}

// ---------- Changelog ----------
export async function getChangelog(): Promise<ChangelogEntry[]> {
  const { data, error } = await supa()
    .from("changelog")
    .select("*")
    .order("date", { ascending: false });
  if (error) {
    console.error("getChangelog", error);
    return [];
  }
  return (data ?? []) as unknown as ChangelogEntry[];
}

export async function addChangelog(entry: ChangelogEntry): Promise<void> {
  const client = supa();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return;
  const { error } = await client.from("changelog").insert({
    user_id: user.id,
    ...entry,
  });
  if (error) console.error("addChangelog", error);
}

// ---------- Protocols ----------
export async function getEnrollments(): Promise<
  {
    id: string;
    protocol_slug: string;
    enrolled_at: string;
    start_date: string;
    status: string;
  }[]
> {
  const { data, error } = await supa()
    .from("protocol_enrollments")
    .select("id, protocol_slug, enrolled_at, start_date, status")
    .order("enrolled_at", { ascending: false });
  if (error) {
    console.error("getEnrollments", error);
    return [];
  }
  return (data ?? []) as {
    id: string;
    protocol_slug: string;
    enrolled_at: string;
    start_date: string;
    status: string;
  }[];
}

export async function getEnrollment(slug: string): Promise<{
  id: string;
  protocol_slug: string;
  enrolled_at: string;
  start_date: string;
  status: string;
} | null> {
  const { data, error } = await supa()
    .from("protocol_enrollments")
    .select("id, protocol_slug, enrolled_at, start_date, status")
    .eq("protocol_slug", slug)
    .maybeSingle();
  if (error) {
    console.error("getEnrollment", error);
    return null;
  }
  return data as {
    id: string;
    protocol_slug: string;
    enrolled_at: string;
    start_date: string;
    status: string;
  } | null;
}

// ---------- Adherence per item ----------

/** Returns adherence (0..1) per item over the last N days. */
export async function getAdherenceMap(
  itemIds: string[],
  days = 14,
): Promise<Record<string, number>> {
  if (itemIds.length === 0) return {};
  const since = new Date(Date.now() - days * 86400000)
    .toISOString()
    .slice(0, 10);
  const { data, error } = await supa()
    .from("stack_log")
    .select("item_id, taken, date")
    .in("item_id", itemIds)
    .gte("date", since);
  if (error) {
    console.error("getAdherenceMap", error);
    return {};
  }
  const counts = new Map<string, { taken: number; total: number }>();
  for (const row of data ?? []) {
    const id = row.item_id as string;
    if (!counts.has(id)) counts.set(id, { taken: 0, total: 0 });
    const c = counts.get(id)!;
    c.total++;
    if (row.taken) c.taken++;
  }
  const map: Record<string, number> = {};
  for (const [id, c] of counts.entries()) {
    map[id] = c.total > 0 ? c.taken / c.total : 0;
  }
  return map;
}

// ---------- Item reactions ----------

export async function getReactionForToday(
  itemId: string,
): Promise<ItemReaction | null> {
  const { data, error } = await supa()
    .from("item_reactions")
    .select("*")
    .eq("item_id", itemId)
    .eq("reacted_on", todayISO())
    .maybeSingle();
  if (error) {
    console.error("getReactionForToday", error);
    return null;
  }
  return data as ItemReaction | null;
}

export async function setReaction(
  itemId: string,
  reaction: ReactionType,
  notes?: string,
): Promise<boolean> {
  const client = supa();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return false;

  const today = todayISO();
  const { error } = await client.from("item_reactions").upsert(
    {
      user_id: user.id,
      item_id: itemId,
      reaction,
      reacted_on: today,
      notes,
    },
    { onConflict: "user_id,item_id,reacted_on" },
  );
  if (error) {
    console.error("setReaction", error);
    return false;
  }
  return true;
}

export async function getRecentReactions(
  itemId: string,
  days = 30,
): Promise<ItemReaction[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supa()
    .from("item_reactions")
    .select("*")
    .eq("item_id", itemId)
    .gte("reacted_on", since.toISOString().slice(0, 10))
    .order("reacted_on", { ascending: false });
  if (error) {
    console.error("getRecentReactions", error);
    return [];
  }
  return (data ?? []) as ItemReaction[];
}

export async function getReactionsSummary(
  itemId: string,
): Promise<{ helped: number; no_change: number; worse: number; forgot: number }> {
  const reactions = await getRecentReactions(itemId, 60);
  return {
    helped: reactions.filter((r) => r.reaction === "helped").length,
    no_change: reactions.filter((r) => r.reaction === "no_change").length,
    worse: reactions.filter((r) => r.reaction === "worse").length,
    forgot: reactions.filter((r) => r.reaction === "forgot").length,
  };
}

// ---------- Legacy no-ops for backwards-compat ----------
export async function ensureSeeded(): Promise<void> {
  // Seeding happens server-side in /auth/callback on first sign-in.
}

export async function resetToSeed(): Promise<void> {
  // Disabled in cloud mode. Would need admin route.
  console.warn("resetToSeed not supported in cloud mode");
}
