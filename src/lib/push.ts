"use client";

// Client-side push subscription helpers.

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    return reg;
  } catch (e) {
    console.error("SW registration failed", e);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export async function subscribeToPush(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return { ok: false, error: "This browser doesn't support notifications." };
  }
  if (!("PushManager" in window)) {
    return { ok: false, error: "This browser doesn't support push." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, error: `Permission: ${permission}` };
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) return { ok: false, error: "VAPID public key not set" };

  const reg = await registerServiceWorker();
  if (!reg) return { ok: false, error: "Service worker not available" };

  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // Cast — TS types for PushManager.subscribe choke on Uint8Array<ArrayBufferLike>
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  const json = sub.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: json.keys,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: `subscribe failed: ${t}` };
  }
  return { ok: true };
}

export async function sendTestPush(): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/push/send-test", { method: "POST" });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: t };
  }
  return { ok: true };
}
