import type { Metadata, Viewport } from "next";
import "./globals.css";
import TabNav from "@/components/TabNav";
import AskClaude from "@/components/AskClaude";
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
  themeColor: "#0E2A1F",
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
        <AskClaude />
        <ToastHost />
        <TabNav />
      </body>
    </html>
  );
}
