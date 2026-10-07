import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";

// DEV ONLY — signs the local dev server in as DEV_LOGIN_EMAIL so visual
// audits can see signed-in pages. Mints a magic-link token server-side
// with the service role and redeems it immediately, so nothing redirects
// to prod. Hard-gated on NODE_ENV + a loopback host; 404s everywhere else.
export async function GET(request: NextRequest) {
  const host = request.nextUrl.hostname;
  const isLoopback =
    host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  const email = process.env.DEV_LOGIN_EMAIL;
  if (process.env.NODE_ENV !== "development" || !isLoopback || !email) {
    return new NextResponse("Not found", { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = data?.properties?.hashed_token;
  if (error || !tokenHash) {
    return NextResponse.json(
      { error: error?.message ?? "no token" },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (verifyError) {
    return NextResponse.json({ error: verifyError.message }, { status: 500 });
  }

  const next = request.nextUrl.searchParams.get("next") ?? "/today";
  return NextResponse.redirect(new URL(next, request.url));
}
