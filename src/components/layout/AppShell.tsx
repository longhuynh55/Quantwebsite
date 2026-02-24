"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar, Header, Footer } from "@/components/layout";
import { CommandPalette } from "@/components/CommandPalette";
import { SkipLink, MainContent, ErrorBoundary } from "@/components/ui";
import { AiAssistantPanel } from "@/components/assistant";
import { ErrorBoundaryWrapper } from "@/components/providers/ErrorBoundaryWrapper";
import { cn } from "@/lib/utils";

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  React.useEffect(() => {
    document.documentElement.setAttribute("data-app-shell-ready", "true");
    return () => {
      document.documentElement.removeAttribute("data-app-shell-ready");
    };
  }, []);

  if (isLanding) {
    return (
      <>
        <SkipLink />
        <ErrorBoundaryWrapper>{children}</ErrorBoundaryWrapper>
      </>
    );
  }

  const fullWidthPaths = ["/strategy-builder"];
  const isFullWidth = fullWidthPaths.includes(pathname);

  return (
    <>
      <SkipLink />
      <div className="flex min-h-screen bg-stone-50 dark:bg-neutral-950 transition-colors duration-300">
        <Sidebar />
        <div className="flex-1 flex flex-col min-h-screen min-w-0">
          <Header />
          <MainContent className={cn(
            "flex-1 w-full overflow-x-hidden py-8",
            isFullWidth
              ? "px-0 py-0"
              : "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8"
          )}>
            <ErrorBoundaryWrapper>{children}</ErrorBoundaryWrapper>
          </MainContent>
          {!isFullWidth && <Footer />}
        </div>
      </div>
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
    </>
  );
}
