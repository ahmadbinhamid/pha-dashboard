import "./globals.css";
import type { Metadata, Viewport } from "next";
import { ThemeScript } from "@/components/theme/theme-script";
import { AppProviders } from "@/components/providers/app-providers";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "hsl(220 14% 98%)" },
    { media: "(prefers-color-scheme: dark)", color: "hsl(222 22% 8%)" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "Parts Hub Australia",
    template: "%s | Parts Hub Australia",
  },
  description: "Automotive parts storefront and operations platform.",
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body
        className="min-h-dvh overflow-x-clip font-sans"
        suppressHydrationWarning
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
