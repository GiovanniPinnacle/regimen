"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import Button, { buttonClass } from "@/components/ui/Button";
import ListRow, { ListGroup } from "@/components/ui/ListRow";

export default function OuraSettings() {
  const [hasPat, setHasPat] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    loadState();
  }, []);

  async function loadState() {
    const r = await fetch("/api/settings/oura");
    const d = await r.json();
    setHasPat(d.hasPat ?? false);
    setLastSync(d.lastSync ?? null);
  }

  async function handleSave() {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/settings/oura", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pat: input.trim() }),
    });
    const d = await r.json();
    if (d.ok) {
      setMsg({ ok: true, text: "Connected. Syncing now…" });
      setHasPat(true);
      setInput("");
      setEditing(false);
      await handleSync();
    } else {
      setMsg({ ok: false, text: `Couldn't connect — ${d.error ?? "check the token and try again"}` });
    }
    setBusy(false);
  }

  async function handleSync() {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/imports/oura-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: 30 }),
    });
    const d = await r.json();
    if (d.ok) {
      setMsg({ ok: true, text: `Synced ${d.synced} days` });
      await loadState();
    } else {
      setMsg({ ok: false, text: `Sync didn't finish — ${d.error ?? "try again in a moment"}` });
    }
    setBusy(false);
  }

  async function handleDisconnect() {
    setBusy(true);
    await fetch("/api/settings/oura", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pat: "" }),
    });
    setHasPat(false);
    setMsg({ ok: true, text: "Disconnected" });
    setBusy(false);
  }

  const status = hasPat
    ? lastSync
      ? `Last synced ${new Date(lastSync).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}`
      : "Connected — not synced yet"
    : "Wake time, HRV, resting heart rate and sleep stages, straight into Today";

  return (
    <div className="flex flex-col gap-4">
      <ListGroup>
        <ListRow
          icon="ring"
          iconTone={hasPat ? "success" : "neutral"}
          title={hasPat ? "Oura connected" : "Oura not connected"}
          subtitle={status}
          chevron={false}
        />
      </ListGroup>

      {!hasPat || editing ? (
        <div className="flex flex-col gap-3">
          <p className="text-callout text-[var(--foreground-soft)]">
            Create a personal access token in your Oura account, then paste it
            below. It only lets Regimen read your data.
          </p>
          <a
            href="https://cloud.ouraring.com/personal-access-tokens"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass({ variant: "secondary", fullWidth: true })}
          >
            <span className="truncate">Get a token from Oura</span>
            <Icon name="external" size={16} strokeWidth={1.9} className="ml-2 shrink-0" />
          </a>
          <label htmlFor="oura-token" className="sr-only">
            Oura personal access token
          </label>
          <input
            id="oura-token"
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste your token"
            autoComplete="off"
            className="input-field"
          />
          <div className="flex gap-2">
            {editing && (
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={!input.trim()}
              loading={busy}
              fullWidth
              className="flex-1 disabled:opacity-50"
            >
              {busy ? "Connecting…" : "Connect and sync"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            icon="refresh"
            onClick={handleSync}
            loading={busy}
            fullWidth
          >
            {busy ? "Syncing…" : "Sync now"}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setEditing(true)}
              disabled={busy}
              className="flex-1"
            >
              Change token
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={busy}
              className="flex-1"
            >
              Disconnect
            </Button>
          </div>
        </div>
      )}

      {msg && (
        <p
          role="status"
          className={`flex items-center gap-1.5 px-1 text-footnote ${
            msg.ok ? "text-[var(--muted)]" : "text-[var(--error)]"
          }`}
        >
          {!msg.ok && <Icon name="alert" size={14} strokeWidth={2} className="shrink-0" />}
          {msg.text}
        </p>
      )}
    </div>
  );
}
