import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsonError, readJson } from "@/lib/api";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("unauthorized", "Not signed in", 401);

  const parsedBody = await readJson<{
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  }>(request);
  if (!parsedBody.ok) return parsedBody.response;
  const { endpoint, keys } = parsedBody.data;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return jsonError("bad_request", "endpoint and keys are required", 400);
  }
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Bad subscription" }, { status: 400 });
  }

  const userAgent = request.headers.get("user-agent") ?? null;

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      user_agent: userAgent,
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) {
    console.error("push subscribe insert", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
