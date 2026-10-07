// Admin-only segment: non-admins get a 404 for this route and every
// subpage. Admin = email in ADMIN_EMAILS (see src/lib/admin.ts).

import { notFound } from "next/navigation";
import { getViewer } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminOnlyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { admin } = await getViewer();
  if (!admin) notFound();
  return <>{children}</>;
}
