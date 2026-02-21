"use client";

import * as React from "react";
import { DashboardLayout } from "@/components/dashboard";
import { MainContent } from "@/components/ui/skip-link";

export default function DashboardPage() {
  return (
    <MainContent className="container mx-auto px-4 py-6">
      <DashboardLayout />
    </MainContent>
  );
}
