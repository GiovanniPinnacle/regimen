// Server-only admin gate. Admin = email listed in the comma-separated
// ADMIN_EMAILS env var (same allowlist the /api/admin routes use).
// Never import from a client component — the env var isn't public.

import { createClient } from "@/lib/supabase/server";

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

/** Resolve the signed-in user and whether they're an admin. */
export async function getViewer(): Promise<{
  id: string | null;
  email: string | null;
  admin: boolean;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? null;
  return { id: user?.id ?? null, email, admin: isAdmin(email) };
}
