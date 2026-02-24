import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./landing.css";
import "katex/dist/katex.min.css";
import { Toaster } from "@/components/ui/toast";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AppShell } from "@/components/layout/AppShell";

const notoSerif = localFont({
  src: [
    { path: "../assets/fonts/noto-serif/NotoSerif-cyrillic-ext.woff2", weight: "400 700", style: "normal" },
    { path: "../assets/fonts/noto-serif/NotoSerif-cyrillic.woff2", weight: "400 700", style: "normal" },
    { path: "../assets/fonts/noto-serif/NotoSerif-greek-ext.woff2", weight: "400 700", style: "normal" },
    { path: "../assets/fonts/noto-serif/NotoSerif-greek.woff2", weight: "400 700", style: "normal" },
    { path: "../assets/fonts/noto-serif/NotoSerif-symbols.woff2", weight: "400 700", style: "normal" },
    { path: "../assets/fonts/noto-serif/NotoSerif-vietnamese.woff2", weight: "400 700", style: "normal" },
    { path: "../assets/fonts/noto-serif/NotoSerif-latin-ext.woff2", weight: "400 700", style: "normal" },
    { path: "../assets/fonts/noto-serif/NotoSerif-latin.woff2", weight: "400 700", style: "normal" },
  ],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "QuantVN",
    template: "%s | QuantVN",
  },
  description: "QuantVN Analytics Platform for HOSE quantitative research and trading workflows.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={`scroll-smooth ${notoSerif.variable}`} suppressHydrationWarning>
      <body className="antialiased min-h-screen font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AppShell>{children}</AppShell>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
