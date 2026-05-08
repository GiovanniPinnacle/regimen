import type { NextConfig } from "next";

// Supabase project host pulled from env at build time so CSP allows
// XHR + image fetches to your specific project. Falls back to `*` for
// supabase.co subdomains so a missing env var doesn't break the build
// (you'll just get a slightly looser policy until you set the var).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_HOST = (() => {
  try {
    return new URL(SUPABASE_URL).host;
  } catch {
    return "*.supabase.co";
  }
})();

const CSP = [
  // Default — only same-origin
  "default-src 'self'",
  // Scripts: self + 'unsafe-inline' + 'unsafe-eval' for Next dev/Turbopack.
  // In production Next emits hash-based inline scripts; we keep the
  // permissive form because the App Router still injects inline RSC
  // payload + Vercel analytics. Tighten later by adopting 'strict-dynamic'
  // + nonces.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Styles: inline from Tailwind + Next
  "style-src 'self' 'unsafe-inline'",
  // Images: self + data URLs (avatars, generated SVGs) + Supabase Storage
  // + common product image hosts (Amazon / iHerb / Thorne / OFF).
  "img-src 'self' data: blob: https://*.supabase.co https://*.amazonaws.com https://*.cloudfront.net https://images.amazon.com https://m.media-amazon.com https://images.openfoodfacts.org https://images.iherb.com https://i.ytimg.com",
  // Fonts: self + data URLs (no third-party fonts)
  "font-src 'self' data:",
  // Connect: self + Supabase + Anthropic + push subscription endpoints
  `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST} https://api.anthropic.com https://*.googleapis.com https://*.openfoodfacts.org`,
  // Media: self + Supabase Storage (voice memos, scalp photos)
  "media-src 'self' blob: https://*.supabase.co",
  // Workers: self only (service worker)
  "worker-src 'self' blob:",
  // Frames: deny everything by default; allow YouTube embeds for tutorials
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  // Block legacy plugins outright
  "object-src 'none'",
  // Form posts only to self
  "form-action 'self'",
  // No mixed content
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  {
    // HSTS — force HTTPS for 2 years, include subdomains, eligible for
    // browser preload list. Vercel terminates TLS so this is safe.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // CSP — see above.
    key: "Content-Security-Policy",
    value: CSP,
  },
  {
    // Don't let other origins iframe us — defense against clickjacking.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Modern equivalent of X-Frame-Options that also covers same-origin
    // popups; "same-origin" lets our own /admin pages embed each other.
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
  {
    // Prevent MIME sniffing.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Don't leak full URL to third parties when users click external
    // affiliate links.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Restrict powerful browser APIs we don't use. Keeps the app
    // privacy-tight and saves us from accidentally exposing camera /
    // location to a future page that doesn't need them.
    key: "Permissions-Policy",
    value: [
      "camera=(self)", // /scan + bloodwork upload
      "microphone=(self)", // voice memo
      "geolocation=()",
      "payment=()",
      "usb=()",
      "interest-cohort=()",
    ].join(", "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply to every route
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
