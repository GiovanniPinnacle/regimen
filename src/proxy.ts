import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/signin",
  "/auth/callback",
  "/auth/confirm",
  // /api/* is excluded by the matcher below (routes auth themselves);
  // kept here as a belt-and-braces guard in case the matcher changes.
  "/api/cron",
  // Compliance pages — App Store + GDPR + CCPA require these be
  // reachable WITHOUT auth so prospective users + regulators can read
  // them before creating an account. Linked from /signin footer.
  "/privacy",
  "/terms",
  // Static offline fallback served by the service worker.
  "/offline.html",
];

// Dev-only sign-in shortcut; the route itself 404s outside local dev.
if (process.env.NODE_ENV === "development") PUBLIC_PATHS.push("/auth/dev-login");

// 90 days — beyond iOS Safari ITP's 7-day storage cap for inactive sites,
// and matches Supabase's refresh-token lifetime so the PWA stays signed in.
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

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, extendCookie(options)),
          );
        },
      },
    },
  );

  // getClaims() verifies the access-token JWT locally against the
  // project's (cached) JWKS when asymmetric signing keys are enabled —
  // no Auth-server round trip per navigation, unlike getUser(). If the
  // token is near expiry it refreshes the session first, which flows
  // through setAll() above so the refreshed cookies reach the browser.
  // (Projects still on a symmetric JWT secret fall back to a server
  // call inside getClaims — same cost as before, never worse.)
  //
  // This is only an optimistic redirect; pages and route handlers still
  // authorize every data access themselves (RLS + getUser in handlers).
  const { data } = await supabase.auth.getClaims();
  const isAuthed = !!data?.claims?.sub;

  const { pathname } = request.nextUrl;
  // "/" is the public landing page (exact match — startsWith("/") would
  // make everything public). Signed-in users on "/" are routed by
  // src/app/page.tsx itself.
  const isPublic =
    pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!isAuthed && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthed && pathname === "/signin") {
    const url = request.nextUrl.clone();
    url.pathname = "/today";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    {
      /*
       * Run on page navigations only. Skip:
       * - api/*          (route handlers authenticate themselves)
       * - _next/static, _next/image
       * - sw.js, offline.html, manifest.json / *.webmanifest
       * - static assets by extension (png, svg, ico, jpg, webp, txt, xml…)
       * - router prefetches (missing: …) — the real navigation that
       *   follows still runs the proxy, so auth + cookie refresh are
       *   unaffected; this just stops every <Link> in view from
       *   triggering a JWT check.
       */
      source:
        "/((?!api/|_next/static|_next/image|sw\\.js|offline\\.html|manifest\\.json|.*\\.(?:png|svg|ico|jpg|jpeg|gif|webp|avif|webmanifest|txt|xml|woff2?)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
