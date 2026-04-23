import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { seedUserIfEmpty } from "@/lib/seed-db";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/today";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // First-time user? Seed their DB with the default regimen.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        try {
          await seedUserIfEmpty(user.id);
        } catch (e) {
          console.error("seed failed", e);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/signin?error=auth_failed`);
}
