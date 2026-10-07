"use client";

// Admin-only: pulls starter items that were added to the app after the
// account was created. Renders nothing unless the viewer is on the
// ADMIN_EMAILS allowlist (checked server-side via viewerIsAdmin; the
// /api/sync-seed route enforces the same gate).

import { useEffect, useState } from "react";
import ListRow, { ListGroup } from "@/components/ui/ListRow";
import { viewerIsAdmin } from "@/app/admin/actions";

export default function SyncSeedButton({
  admin: adminProp,
}: {
  /** Pass when the parent already knows; skips the server check. */
  admin?: boolean;
} = {}) {
  const [checkedAdmin, setCheckedAdmin] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (adminProp !== undefined) return;
    let alive = true;
    viewerIsAdmin()
      .then((ok) => alive && setCheckedAdmin(ok))
      .catch(() => alive && setCheckedAdmin(false));
    return () => {
      alive = false;
    };
  }, [adminProp]);

  const admin = adminProp ?? checkedAdmin;
  if (!admin) return null;

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    setFailed(false);
    try {
      const res = await fetch("/api/sync-seed", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setResult(
          data.inserted > 0
            ? `Added ${data.inserted} new item${data.inserted === 1 ? "" : "s"}`
            : "Already up to date",
        );
        if (data.inserted > 0) {
          setTimeout(() => window.location.reload(), 1200);
        }
      } else {
        console.error("sync-seed failed", data.error);
        setFailed(true);
        setResult("Couldn’t update. Try again.");
      }
    } catch (e) {
      console.error("sync-seed failed", e);
      setFailed(true);
      setResult("Couldn’t update. Check your connection.");
    }
    setSyncing(false);
  }

  return (
    <ListGroup>
      <ListRow
        icon="refresh"
        iconTone={failed ? "danger" : "neutral"}
        title={syncing ? "Updating…" : "Get new starter items"}
        subtitle={result ?? "Add any starter items released since you joined"}
        onClick={syncing ? undefined : handleSync}
      />
    </ListGroup>
  );
}
