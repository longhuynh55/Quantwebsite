import { Suspense } from "react";
import ScreenerClient from "./ScreenerClient";

export default function ScreenerPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-stone-500 dark:text-neutral-400">Loading screener workspace...</div>}>
      <ScreenerClient />
    </Suspense>
  );
}

