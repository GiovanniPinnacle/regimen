"use client";

import { useState } from "react";
import { subscribeToPush, sendTestPush } from "@/lib/push";
import Button from "@/components/ui/Button";
import Icon from "@/components/Icon";

type State = "unknown" | "unsupported" | "denied" | "granted" | "default";

export default function PushSettings() {
  const [state, setState] = useState<State>(() => {
    if (typeof window === "undefined") return "unknown";
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return "unsupported";
    }
    return Notification.permission as State;
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleEnable() {
    setBusy(true);
    setMsg(null);
    const res = await subscribeToPush();
    if (res.ok) {
      setState("granted");
      setMsg("Notifications are on for this device.");
    } else {
      setMsg(`Couldn't turn on notifications: ${res.error}`);
    }
    setBusy(false);
  }

  async function handleTest() {
    setBusy(true);
    setMsg(null);
    const res = await sendTestPush();
    if (res.ok) setMsg("Test sent — it should arrive in a few seconds.");
    else setMsg(`Test failed: ${res.error ?? "unknown error"}`);
    setBusy(false);
  }

  if (state === "unsupported") {
    return (
      <p className="text-callout text-[var(--muted)]">
        This browser doesn&apos;t support notifications. On iPhone, add
        Regimen to your Home Screen first (Safari → Share → Add to Home
        Screen), open it from there, and try again.
      </p>
    );
  }

  if (state === "denied") {
    return (
      <p className="text-callout text-[var(--muted)]">
        Notifications are blocked for Regimen. Turn them on in your device
        or browser settings, then come back here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {state === "granted" ? (
        <>
          <div className="flex items-start gap-3 rounded-[14px] bg-[var(--success-tint)] p-4">
            <Icon
              name="check-circle"
              size={20}
              strokeWidth={1.8}
              className="mt-0.5 shrink-0 text-[var(--success)]"
            />
            <div>
              <div className="text-body font-semibold">Notifications are on</div>
              <div className="mt-0.5 text-footnote text-[var(--foreground-soft)]">
                Daily check-ins, dose reminders, and milestone nudges will
                arrive on this device.
              </div>
            </div>
          </div>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            icon="send"
            loading={busy}
            onClick={handleTest}
          >
            Send a test notification
          </Button>
        </>
      ) : (
        <>
          <p className="text-callout text-[var(--foreground-soft)]">
            Get a daily check-in, dose reminders, and milestone nudges on
            this device. You can turn them off any time.
          </p>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            icon="bell"
            loading={busy}
            onClick={handleEnable}
          >
            {busy ? "Requesting permission…" : "Turn on notifications"}
          </Button>
        </>
      )}

      {msg && (
        <p className="px-1 text-footnote text-[var(--muted)]" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
