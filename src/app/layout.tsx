import type { Metadata, Viewport } from "next";
import "./globals.css";
import TabNav from "@/components/TabNav";
// Heavy / non-critical surfaces are lazy — see CoachLazy.tsx and
// FabsLazy.tsx for the rationale. Drops ~250KB off first paint on
// every route and only pays the cost when the user actually engages.
import CoachLazy from "@/components/CoachLazy";
import FabsLazy from "@/components/FabsLazy";
import SessionKeeper from "@/components/SessionKeeper";
import ToastHost from "@/components/ToastHost";

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
  themeColor: "#0A0B0D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased pb-20">
        <SessionKeeper />
        <main className="flex-1 w-full max-w-3xl mx-auto px-5 pt-8">
          {children}
        </main>
        <CoachLazy />
        <FabsLazy />
        <ToastHost />
        <TabNav />
      </body>
    </html>
  );
}
