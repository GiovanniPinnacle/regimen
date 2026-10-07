"use server";

// Server functions for admin-only client UI. ADMIN_EMAILS is a server
// env var, so client components ask here instead of reading it.

import { getViewer } from "@/lib/admin";

/** True when the signed-in user is on the ADMIN_EMAILS allowlist. */
export async function viewerIsAdmin(): Promise<boolean> {
  const { admin } = await getViewer();
  return admin;
}
