"use client";

import { useEffect, useState } from "react";
import { subscribeToPush, sendTestPush } from "@/lib/push";

type State = "unknown" | "unsupported" | "denied" | "granted" | "default";

export default function PushSettings() {
  const [state, setState] = useState<State>("unknown");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setState("unsupported");
      return;
    }
    setState(Notification.permission as State);
  }, []);

  async function handleEnable() {
    setBusy(true);
    setMsg(null);
    const res = await subscribeToPush();
    if (res.ok) {
      setState("granted");
      setMsg("✓ Notifications enabled");
    } else {
      setMsg(`Error: ${res.error}`);
    }
    setBusy(false);
  }

  async function handleTest() {
    setBusy(true);
    setMsg(null);
    const res = await sendTestPush();
    if (res.ok) setMsg("✓ Test sent — check your notifications");
    else setMsg(`Error: ${res.error ?? "failed"}`);
    setBusy(false);
  }

  if (state === "unsupported") {
    return (
      <div
        className="border-hair rounded-xl p-4 text-[13px]"
        style={{ color: "var(--muted)" }}
      >
        This browser doesn&apos;t support notifications. On iPhone, install the
        app to your home screen first (Safari → Share → Add to Home Screen),
        then open it from there and try again.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {state === "granted" ? (
        <>
          <div
            className="border-hair rounded-xl p-4"
            style={{ background: "#E1F5EE", color: "#04342C" }}
          >
            <div className="text-[14px]" style={{ fontWeight: 500 }}>
              ✓ Notifications enabled
            </div>
            <div className="text-[13px] mt-1" style={{ opacity: 0.85 }}>
              Daily morning check-in + biotin alerts + cycle flips + day-milestone triggers will push to this device.
            </div>
          </div>
          <button
            onClick={handleTest}
            disabled={busy}
            className="border-hair rounded-xl p-4 w-full text-left"
          >
            <div className="text-[15px]" style={{ fontWeight: 500 }}>
              {busy ? "Sending…" : "Send test notification"}
            </div>
            <div className="text-[13px]" style={{ color: "var(--muted)" }}>
              Should arrive within a few seconds
            </div>
          </button>
        </>
      ) : (
        <button
          onClick={handleEnable}
          disabled={busy}
          className="border-hair rounded-xl p-4 w-full text-left"
          style={{
            background: "var(--foreground)",
            color: "var(--background)",
          }}
        >
          <div className="text-[15px]" style={{ fontWeight: 500 }}>
            {busy ? "Requesting permission…" : "🔔 Enable notifications"}
          </div>
          <div
            className="text-[13px]"
            style={{ color: "var(--background)", opacity: 0.75 }}
          >
            Morning check-ins + biotin/cycle/milestone alerts on your phone
          </div>
        </button>
      )}

      {msg && (
        <div
          className="text-[12px] px-2"
          style={{ color: "var(--muted)" }}
        >
          {msg}
        </div>
      )}
    </div>
  );
}
