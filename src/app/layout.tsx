import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000");

const description = "An AI voice agent that calls customers whose autopay failed, verifies them, and recovers the payment. Try it in your browser.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Autopay Recovery Agent · Voice AI demo",
  description,
  applicationName: "Autopay Recovery",
  openGraph: {
    title: "Autopay Recovery Agent",
    description,
    type: "website",
    siteName: "Autopay Recovery",
  },
  twitter: { card: "summary_large_image", title: "Autopay Recovery Agent", description },
};

export const viewport: Viewport = { themeColor: "#2563eb" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full text-slate-900">{children}</body>
    </html>
  );
}
