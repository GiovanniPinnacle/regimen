// Server-side push sender using web-push.
// Sends to all subscriptions for a user_id.

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let initialized = false;
function init() {
  if (initialized) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";
  if (!pub || !priv) throw new Error("VAPID keys not set");
  webpush.setVapidDetails(subject, pub, priv);
  initialized = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number; removed: number }> {
  init();
  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  if (error || !subs || subs.length === 0) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const s of subs) {
    const sub = {
      endpoint: s.endpoint as string,
      keys: { p256dh: s.p256dh as string, auth: s.auth as string },
    };
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      sent++;
    } catch (e) {
      const err = e as { statusCode?: number; message?: string };
      console.error("push send failed", err.statusCode, err.message);
      // 404 / 410 = subscription is gone, clean up
      if (err.statusCode === 404 || err.statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", s.id);
        removed++;
      } else {
        failed++;
      }
    }
  }
  return { sent, failed, removed };
}
