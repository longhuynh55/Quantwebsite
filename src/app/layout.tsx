import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar, Footer } from "@/components/layout";
import { Toaster } from "@/components/ui/toast";
import { CommandPalette } from "@/components/CommandPalette";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "QuantVN - Vietnamese Stock Market Quantitative Finance Platform",
    template: "%s | QuantVN",
  },
  description: "A comprehensive quantitative finance platform for analyzing, backtesting, and optimizing investment strategies on the Vietnamese stock market (HOSE).",
  keywords: ["quantitative finance", "Vietnam stock market", "HOSE", "backtesting", "portfolio optimization", "factor investing", "risk management", "technical analysis"],
  authors: [{ name: "QuantVN Team" }],
  creator: "QuantVN",
  publisher: "QuantVN",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "QuantVN",
    title: "QuantVN - Vietnamese Stock Market Quantitative Finance Platform",
    description: "A comprehensive quantitative finance platform for analyzing, backtesting, and optimizing investment strategies on the Vietnamese stock market (HOSE).",
  },
  twitter: {
    card: "summary_large_image",
    title: "QuantVN - Vietnamese Stock Market Quantitative Finance Platform",
    description: "A comprehensive quantitative finance platform for analyzing, backtesting, and optimizing investment strategies on the Vietnamese stock market (HOSE).",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} antialiased min-h-screen flex flex-col bg-white text-gray-900`}>
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
        <Toaster />
        <CommandPalette />
      </body>
    </html>
  );
}
