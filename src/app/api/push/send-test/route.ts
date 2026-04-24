import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push-server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const result = await sendPushToUser(user.id, {
    title: "Regimen test push ✓",
    body: "If you see this, notifications are working.",
    url: "/today",
    tag: "test",
  });
  return NextResponse.json(result);
}
