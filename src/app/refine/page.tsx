// /refine has been merged into /insights — refine is now one section there
// alongside patterns, adherence, reactions, and voice memos. The route stays
// to keep any old links/bookmarks working.

import { redirect } from "next/navigation";

export default function RefineRedirect() {
  redirect("/insights");
}
