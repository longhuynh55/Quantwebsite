import { Suspense } from "react";
import { StrategyMarketplace } from "@/components/community";
import { Skeleton } from "@/components/ui/skeleton";

// Loading skeleton for the marketplace
function MarketplaceSkeleton() {
  return (
    <div className="max-w-full space-y-6">
      {/* Header skeleton */}
      <div className="mb-8">
        <Skeleton className="mb-2 h-10 w-72" />
        <Skeleton className="h-5 w-[32rem] max-w-full" />
      </div>

      {/* Stats skeleton */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>

      {/* Search skeleton */}
      <Skeleton className="h-16 mb-6" />

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
    </div>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={<MarketplaceSkeleton />}>
      <StrategyMarketplace />
    </Suspense>
  );
}
