import type { Metadata, Viewport } from "next";
import "./globals.css";
import TabNav from "@/components/TabNav";

export const metadata: Metadata = {
  title: "Regimen",
  description: "Personal health protocol management",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Regimen",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
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
        <main className="flex-1 w-full max-w-3xl mx-auto px-5 pt-8">
          {children}
        </main>
        <TabNav />
      </body>
    </html>
  );
}
