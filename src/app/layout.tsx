import type { Metadata, Viewport } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import { Sidebar, Header, Footer } from "@/components/layout";
import { Toaster } from "@/components/ui/toast";
import { CommandPalette } from "@/components/CommandPalette";
import { SkipLink, MainContent, ErrorBoundary } from "@/components/ui";
import { AiAssistantPanel } from "@/components/assistant";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ErrorBoundaryWrapper } from "@/components/providers/ErrorBoundaryWrapper";

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
    <html lang="vi" className="scroll-smooth" suppressHydrationWarning>
      <body className="antialiased min-h-screen font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SkipLink />
          <div className="flex min-h-screen bg-white dark:bg-slate-950 transition-colors duration-300">
            <Sidebar />
            <div className="flex-1 flex flex-col min-h-screen min-w-0">
              <Header />
              <MainContent className="flex-1 w-full max-w-full overflow-x-hidden px-4 sm:px-6 lg:px-8 py-8">
                <ErrorBoundaryWrapper>
                  {children}
                </ErrorBoundaryWrapper>
              </MainContent>
              <Footer />
            </div>
          </div>
          <Toaster />
          <CommandPalette />
          <ErrorBoundary
            fallback={
              <div className="sr-only">
                AI Assistant encountered an error
              </div>
            }
          >
            <AiAssistantPanel />
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
