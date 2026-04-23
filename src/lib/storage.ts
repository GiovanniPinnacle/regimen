// LocalStorage-backed data layer.
// Designed with async signatures so we can swap to Supabase later
// without changing any component code.

import type { Item, StackLogEntry, SymptomLog, ChangelogEntry } from "./types";
import {
  SEED_ITEMS,
  QUEUED_ITEMS,
  BACKBURNER_ITEMS,
} from "./seed";

const KEYS = {
  ITEMS: "regimen.items.v1",
  STACK_LOG: "regimen.stackLog.v1",
  SYMPTOM_LOG: "regimen.symptomLog.v1",
  CHANGELOG: "regimen.changelog.v1",
  SEEDED: "regimen.seeded.v1",
};

// ---------- LocalStorage helpers (SSR-safe) ----------
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("storage.write failed", key, e);
  }
}

// ---------- First-run seeding ----------
export async function ensureSeeded(): Promise<void> {
  if (!isBrowser()) return;
  if (window.localStorage.getItem(KEYS.SEEDED) === "true") return;
  const allSeed: Item[] = [...SEED_ITEMS, ...QUEUED_ITEMS, ...BACKBURNER_ITEMS];
  write(KEYS.ITEMS, allSeed);
  window.localStorage.setItem(KEYS.SEEDED, "true");
}

export async function resetToSeed(): Promise<void> {
  if (!isBrowser()) return;
  window.localStorage.removeItem(KEYS.ITEMS);
  window.localStorage.removeItem(KEYS.STACK_LOG);
  window.localStorage.removeItem(KEYS.SYMPTOM_LOG);
  window.localStorage.removeItem(KEYS.CHANGELOG);
  window.localStorage.removeItem(KEYS.SEEDED);
  await ensureSeeded();
}

// ---------- Items ----------
export async function getAllItems(): Promise<Item[]> {
  await ensureSeeded();
  return read<Item[]>(KEYS.ITEMS, []);
}

export async function getItemsByStatus(
  status: Item["status"],
): Promise<Item[]> {
  const all = await getAllItems();
  return all.filter((i) => i.status === status);
}

export async function getItem(id: string): Promise<Item | null> {
  const all = await getAllItems();
  return all.find((i) => i.id === id) ?? null;
}

export async function upsertItem(item: Item): Promise<void> {
  const all = await getAllItems();
  const idx = all.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    all[idx] = item;
  } else {
    all.push(item);
  }
  write(KEYS.ITEMS, all);
}

// ---------- Stack log (daily check-offs) ----------
export async function getStackLog(date: string): Promise<StackLogEntry[]> {
  const log = read<StackLogEntry[]>(KEYS.STACK_LOG, []);
  return log.filter((e) => e.date === date);
}

export async function getTakenMap(date: string): Promise<Record<string, boolean>> {
  const entries = await getStackLog(date);
  const map: Record<string, boolean> = {};
  for (const e of entries) map[e.item_id] = e.taken;
  return map;
}

export async function toggleTaken(date: string, itemId: string): Promise<boolean> {
  const log = read<StackLogEntry[]>(KEYS.STACK_LOG, []);
  const existing = log.find((e) => e.date === date && e.item_id === itemId);
  if (existing) {
    existing.taken = !existing.taken;
    existing.logged_at = new Date().toISOString();
    write(KEYS.STACK_LOG, log);
    return existing.taken;
  }
  const entry: StackLogEntry = {
    id: `${date}_${itemId}_${Date.now()}`,
    date,
    item_id: itemId,
    taken: true,
    logged_at: new Date().toISOString(),
  };
  log.push(entry);
  write(KEYS.STACK_LOG, log);
  return true;
}

// ---------- Symptom log ----------
export async function getSymptomLog(date: string): Promise<SymptomLog | null> {
  const all = read<SymptomLog[]>(KEYS.SYMPTOM_LOG, []);
  return all.find((s) => s.date === date) ?? null;
}

export async function saveSymptomLog(log: SymptomLog): Promise<void> {
  const all = read<SymptomLog[]>(KEYS.SYMPTOM_LOG, []);
  const idx = all.findIndex((s) => s.date === log.date);
  if (idx >= 0) all[idx] = log;
  else all.push(log);
  write(KEYS.SYMPTOM_LOG, all);
}

export async function getRecentSymptomLogs(days: number): Promise<SymptomLog[]> {
  const all = read<SymptomLog[]>(KEYS.SYMPTOM_LOG, []);
  return all
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, days);
}

// ---------- Changelog ----------
export async function getChangelog(): Promise<ChangelogEntry[]> {
  return read<ChangelogEntry[]>(KEYS.CHANGELOG, []).sort((a, b) =>
    a.date < b.date ? 1 : -1,
  );
}

export async function addChangelog(entry: ChangelogEntry): Promise<void> {
  const all = await getChangelog();
  all.push(entry);
  write(KEYS.CHANGELOG, all);
}
