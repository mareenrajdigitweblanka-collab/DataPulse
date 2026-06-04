import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DataPulse",
  description: "Multi-Channel Web Scraping Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}