// /queued is now a tab inside /stack — redirect old links there.

import { redirect } from "next/navigation";

export default function QueuedRedirect() {
  redirect("/stack");
}
