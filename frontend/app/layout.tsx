import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "DataPulse — Multi-Channel Web Scraping Platform",
  description:
    "DataPulse is a professional multi-channel web scraping platform. Scrape products from Shopify, eBay, Google Shopping, and Amazon with powerful filters.",
  keywords: ["web scraping", "data extraction", "shopify", "ebay", "amazon", "google shopping"],
};

/**
 * Inline script to set dark mode class BEFORE React hydrates.
 * This prevents the "flash of wrong theme" (FOUWT) on page load.
 */
const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('datapulse_theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored === 'dark' || (stored !== 'light' && prefersDark);
    if (dark) document.documentElement.classList.add('dark');
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}