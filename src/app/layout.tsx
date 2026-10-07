import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import TabNav from "@/components/TabNav";
// Coach is lazy — CoachLazy is a tiny event listener; the Coach chunk
// loads on the first open (see CoachLazy.tsx).
import CoachLazy from "@/components/CoachLazy";
import SessionKeeper from "@/components/SessionKeeper";
import ToastHost from "@/components/ToastHost";

// iOS/macOS keep SF Pro (first in the stack); everyone else gets Inter
// instead of falling through to Roboto / Segoe.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Regimen",
  description: "Personal health protocol management",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Regimen",
    startupImage: ["/icon-512.png"],
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0E1014",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`}>
      <body className="min-h-full flex flex-col antialiased">
        <SessionKeeper />
        {/* Top: status bar (viewportFit=cover) + 16px. Bottom: clears the
            56px tab bar + home indicator + 24px breathing room. */}
        <main
          className="flex-1 w-full max-w-3xl mx-auto px-5"
          style={{
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
            paddingLeft: "max(20px, env(safe-area-inset-left, 0px))",
            paddingRight: "max(20px, env(safe-area-inset-right, 0px))",
          }}
        >
          {children}
        </main>
        <CoachLazy />
        <ToastHost />
        <TabNav />
      </body>
    </html>
  );
}
