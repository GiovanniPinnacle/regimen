// Snooze — small client-side utility for "hide this item from Today
// for X minutes." We use localStorage instead of a DB column because:
//   1. Snooze is ephemeral (rarely lasts > a few hours)
//   2. Avoiding a DB write lets the action feel instant
//   3. Snooze state is per-device anyway — if you snooze on phone but
//      open on laptop, you probably want to see it
//
// Key: `regimen.snooze.<itemId>` → epoch ms when snooze expires.
// Past-expiry entries are cleaned up lazily on read.

export type SnoozeOption = {
  /** Visible label in the picker. */
  label: string;
  /** Minutes to snooze for. */
  minutes: number;
};

/** Default options offered by the inline Snooze picker. The first is
 *  the default if user single-taps without picking; the rest are in a
 *  small popover. Picked to cover "I'll deal with this in an hour" up
 *  to "tomorrow morning". */
export const SNOOZE_OPTIONS: SnoozeOption[] = [
  { label: "1 hour", minutes: 60 },
  { label: "3 hours", minutes: 180 },
  { label: "Til tomorrow", minutes: 60 * 12 },
];

const KEY_PREFIX = "regimen.snooze.";

/** Persist a snooze for `minutes` from now. Returns the epoch-ms expiry
 *  so callers can format a "snoozed til 4:15pm" message. */
export function snoozeItem(itemId: string, minutes: number): number {
  const until = Date.now() + minutes * 60 * 1000;
  try {
    localStorage.setItem(`${KEY_PREFIX}${itemId}`, String(until));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — caller's
    // optimistic UI will fail back to no-op next render. Acceptable.
  }
  // Notify any subscribed surfaces (Today's snoozedIds memo) to refresh.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("regimen:snooze-changed"));
  }
  return until;
}

/** Drop a previously-set snooze (e.g. user hit Undo on the toast). */
export function clearSnooze(itemId: string) {
  try {
    localStorage.removeItem(`${KEY_PREFIX}${itemId}`);
  } catch {}
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("regimen:snooze-changed"));
  }
}

/** Is the item currently snoozed? Cleans up expired entries lazily. */
export function isSnoozed(itemId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${itemId}`);
    if (!raw) return false;
    const t = parseInt(raw, 10);
    if (!Number.isFinite(t)) return false;
    if (t <= Date.now()) {
      localStorage.removeItem(`${KEY_PREFIX}${itemId}`);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Returns the epoch-ms expiry for an item, or null if not snoozed. */
export function snoozeExpiry(itemId: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${itemId}`);
    if (!raw) return null;
    const t = parseInt(raw, 10);
    if (!Number.isFinite(t) || t <= Date.now()) return null;
    return t;
  } catch {
    return null;
  }
}

/** Format an expiry as "4:15 PM" in the user's locale. */
export function formatExpiry(expiry: number): string {
  return new Date(expiry).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
