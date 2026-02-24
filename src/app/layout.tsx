import type { Metadata, Viewport } from "next";
import { Noto_Serif } from "next/font/google";
import "./globals.css";
import "./landing.css";
import "katex/dist/katex.min.css";
import { Toaster } from "@/components/ui/toast";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AppShell } from "@/components/layout/AppShell";

const notoSerif = Noto_Serif({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "700"],
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