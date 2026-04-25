import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Match middleware: 90-day cookies survive iOS Safari ITP eviction.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

function extendCookie(options: CookieOptions = {}): CookieOptions {
  return {
    ...options,
    maxAge: options.maxAge ?? COOKIE_MAX_AGE,
    sameSite: options.sameSite ?? "lax",
    secure: options.secure ?? true,
    path: options.path ?? "/",
  };
}

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, extendCookie(options)),
            );
          } catch {
            // `setAll` can be called from a Server Component where cookies are
            // read-only. Ignore — middleware handles refresh.
          }
        },
      },
    },
  );
}
