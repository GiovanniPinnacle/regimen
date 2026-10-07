// /scan — server wrapper so the client scanner can be told whether to
// offer admin-only scan types (see ScanClient).

import { getViewer } from "@/lib/admin";
import ScanClient from "./ScanClient";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const { admin } = await getViewer();
  return <ScanClient showRecovery={admin} />;
}
