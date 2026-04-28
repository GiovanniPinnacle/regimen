// Unenroll from a protocol. Soft cancel: protocol_enrollments.status →
// 'cancelled'. Items are NOT auto-deleted (user has been logging against
// them; nuking them would lose data). Items the user wants to drop can be
// retired one-by-one via ItemQuickActions, OR they can pass
// remove_items=true to retire all protocol-linked items in one shot.

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/constants";

type Body = {
  slug: string;
  remove_items?: boolean;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  if (!body.slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const { error: enrollErr } = await supabase
    .from("protocol_enrollments")
    .update({ status: "cancelled" })
    .eq("user_id", user.id)
    .eq("protocol_slug", body.slug);

  if (enrollErr) {
    return NextResponse.json(
      { error: enrollErr.message },
      { status: 500 },
    );
  }

  let retired = 0;
  if (body.remove_items) {
    const { data, error: itemErr } = await supabase
      .from("items")
      .update({ status: "retired" })
      .eq("user_id", user.id)
      .eq("from_protocol_slug", body.slug)
      .in("status", ["active", "queued"])
      .select("id");
    if (itemErr) {
      return NextResponse.json(
        { error: itemErr.message },
        { status: 500 },
      );
    }
    retired = data?.length ?? 0;
  }

  await supabase.from("changelog").insert({
    user_id: user.id,
    date: todayISO(),
    change_type: "unenroll_protocol",
    item_name: body.slug,
    reasoning: body.remove_items
      ? `Unenrolled from ${body.slug}, retired ${retired} linked items`
      : `Unenrolled from ${body.slug}, items kept active`,
    triggered_by: "user",
  });

  return NextResponse.json({ ok: true, retired_items: retired });
}
