"use client";

import { useEffect, useState } from "react";
import { subscribeToPush } from "@/lib/push";

type Env = "loading" | "desktop" | "ios_browser" | "ios_pwa" | "android";
type PushState = "unknown" | "unsupported" | "default" | "granted" | "denied";

export default function OnboardingBanner() {
  const [env, setEnv] = useState<Env>("loading");
  const [pushState, setPushState] = useState<PushState>("unknown");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (localStorage.getItem("regimen.onboarding.dismissed") === "1") {
      setDismissed(true);
    }

    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;

    if (isIOS && !isStandalone) setEnv("ios_browser");
    else if (isIOS && isStandalone) setEnv("ios_pwa");
    else if (isAndroid) setEnv("android");
    else setEnv("desktop");

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPushState("unsupported");
    } else {
      setPushState(Notification.permission as PushState);
    }
  }, []);

  async function handleEnable() {
    setBusy(true);
    setMsg(null);
    const res = await subscribeToPush();
    if (res.ok) {
      setPushState("granted");
      setMsg("✓ You'll get daily morning check-ins + alerts");
    } else {
      setMsg(`Couldn't enable: ${res.error}`);
    }
    setBusy(false);
  }

  function handleDismiss() {
    localStorage.setItem("regimen.onboarding.dismissed", "1");
    setDismissed(true);
  }

  if (dismissed) return null;
  if (env === "loading") return null;

  // Nothing to nag about if already set up
  if (pushState === "granted") return null;
  if (pushState === "unsupported" && env === "desktop") return null;

  let title = "";
  let body: React.ReactNode = null;
  let action: React.ReactNode = null;

  if (env === "ios_browser") {
    title = "📲 Install to your home screen";
    body = (
      <>
        To get push notifications on iPhone, install Regimen first:
        <br />
        <br />
        <strong>1.</strong> Tap the <strong>Share</strong> button (square with
        arrow up) at the bottom of Safari
        <br />
        <strong>2.</strong> Scroll down, tap <strong>&quot;Add to Home Screen&quot;</strong>
        <br />
        <strong>3.</strong> Name it &quot;Regimen&quot; → tap Add
        <br />
        <strong>4.</strong> Open Regimen from your home screen → come back here
        → tap Enable
      </>
    );
  } else if (env === "ios_pwa" && pushState === "default") {
    title = "🔔 Enable notifications";
    body = (
      <>
        Get your daily morning check-in + biotin alerts + cycle flip reminders
        right on your phone. Tap below and tap &quot;Allow&quot; when iOS prompts.
      </>
    );
    action = (
      <button
        onClick={handleEnable}
        disabled={busy}
        className="px-4 py-2.5 rounded-lg text-[14px] mt-3"
        style={{
          background: "var(--foreground)",
          color: "var(--background)",
          fontWeight: 500,
        }}
      >
        {busy ? "Requesting…" : "Enable notifications"}
      </button>
    );
  } else if (env === "ios_pwa" && pushState === "denied") {
    title = "🔔 Notifications are blocked";
    body = (
      <>
        To turn them on: <strong>iPhone Settings → Notifications → Regimen →
        Allow Notifications</strong>
      </>
    );
  } else if (pushState === "default") {
    title = "🔔 Enable notifications";
    body = <>Daily morning check-ins + biotin/cycle/milestone alerts.</>;
    action = (
      <button
        onClick={handleEnable}
        disabled={busy}
        className="px-4 py-2.5 rounded-lg text-[14px] mt-3"
        style={{
          background: "var(--foreground)",
          color: "var(--background)",
          fontWeight: 500,
        }}
      >
        {busy ? "Requesting…" : "Enable notifications"}
      </button>
    );
  } else if (pushState === "denied") {
    title = "🔔 Notifications blocked";
    body = (
      <>Re-enable in your browser settings → site permissions → Regimen → Allow.</>
    );
  } else {
    return null;
  }

  return (
    <div
      className="border-hair rounded-xl p-4 mb-4 flex items-start gap-3"
      style={{ background: "var(--surface-alt)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[14px] leading-snug" style={{ fontWeight: 500 }}>
          {title}
        </div>
        <div
          className="text-[13px] mt-1"
          style={{ color: "var(--muted)", lineHeight: 1.5 }}
        >
          {body}
        </div>
        {action}
        {msg && (
          <div
            className="text-[12px] mt-2"
            style={{ color: "var(--muted)" }}
          >
            {msg}
          </div>
        )}
      </div>
      <button
        onClick={handleDismiss}
        className="shrink-0 text-[18px] leading-none"
        style={{ color: "var(--muted)" }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
