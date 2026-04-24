// Supabase-backed data layer.
// Uses the browser client — RLS ensures each user sees only their own rows.
// Interface is async and mirrors the previous localStorage version
// so components didn't need to change.

"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  ChangelogEntry,
  Item,
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
      .update({ taken: newTaken, logged_at: new Date().toISOString() })
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

// ---------- Legacy no-ops for backwards-compat ----------
export async function ensureSeeded(): Promise<void> {
  // Seeding happens server-side in /auth/callback on first sign-in.
}

export async function resetToSeed(): Promise<void> {
  // Disabled in cloud mode. Would need admin route.
  console.warn("resetToSeed not supported in cloud mode");
}
