"use client";

import { ErrorBoundary } from "@/components/ui";

interface ErrorBoundaryWrapperProps {
  children: React.ReactNode;
}

export function ErrorBoundaryWrapper({ children }: ErrorBoundaryWrapperProps) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error("Application error:", error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
