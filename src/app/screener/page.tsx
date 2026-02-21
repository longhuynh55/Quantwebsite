import { Suspense } from "react";
import ScreenerClient from "./ScreenerClient";

export default function ScreenerPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500 dark:text-slate-400">Loading screener workspace...</div>}>
      <ScreenerClient />
    </Suspense>
  );
}

