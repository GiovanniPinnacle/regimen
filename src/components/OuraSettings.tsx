"use client";

import { useEffect, useState } from "react";

export default function OuraSettings() {
  const [hasPat, setHasPat] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
      setMsg("✓ Saved. Syncing now…");
      setHasPat(true);
      setInput("");
      setEditing(false);
      await handleSync();
    } else {
      setMsg(`Error: ${d.error}`);
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
      setMsg(`✓ Synced ${d.synced} days`);
      await loadState();
    } else {
      setMsg(`Sync failed: ${d.error}`);
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
    setMsg("Disconnected");
    setBusy(false);
  }

  return (
    <div className="border-hair rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px]" style={{ fontWeight: 500 }}>
            💍 Oura sync
          </div>
          <div
            className="text-[13px] mt-0.5"
            style={{ color: "var(--muted)" }}
          >
            {hasPat
              ? lastSync
                ? `Last sync: ${new Date(lastSync).toLocaleString()}`
                : "Connected — not yet synced"
              : "Live wake time, HRV, RHR, sleep stages → Today tab uses real data"}
          </div>
        </div>
      </div>

      {!hasPat || editing ? (
        <>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            Get your Oura Personal Access Token at{" "}
            <a
              href="https://cloud.ouraring.com/personal-access-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              cloud.ouraring.com/personal-access-tokens
            </a>
          </div>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste your Oura PAT here"
            className="border-hair rounded-lg px-3 py-2.5 text-[14px] focus:outline-none focus:border-hair-strong"
            style={{ background: "var(--background)", color: "var(--foreground)" }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!input.trim() || busy}
              className="px-4 py-2.5 rounded-lg text-[14px]"
              style={{
                background: "var(--foreground)",
                color: "var(--background)",
                fontWeight: 500,
                opacity: !input.trim() || busy ? 0.5 : 1,
              }}
            >
              {busy ? "Saving…" : "Save + sync"}
            </button>
            {editing && (
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2.5 rounded-lg text-[14px] border-hair"
                style={{ color: "var(--muted)" }}
              >
                Cancel
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleSync}
            disabled={busy}
            className="px-3 py-2 rounded-lg text-[13px] border-hair"
            style={{
              background: "var(--foreground)",
              color: "var(--background)",
              fontWeight: 500,
            }}
          >
            {busy ? "Syncing…" : "Sync now"}
          </button>
          <button
            onClick={() => setEditing(true)}
            disabled={busy}
            className="px-3 py-2 rounded-lg text-[13px] border-hair"
            style={{ color: "var(--muted)" }}
          >
            Update PAT
          </button>
          <button
            onClick={handleDisconnect}
            disabled={busy}
            className="px-3 py-2 rounded-lg text-[13px] border-hair"
            style={{ color: "#b00020" }}
          >
            Disconnect
          </button>
        </div>
      )}

      {msg && (
        <div className="text-[12px]" style={{ color: "var(--muted)" }}>
          {msg}
        </div>
      )}
    </div>
  );
}
