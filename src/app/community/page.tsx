import { Suspense } from "react";
import { StrategyMarketplace } from "@/components/community";
import { Skeleton } from "@/components/ui/skeleton";

// Loading skeleton for the marketplace
function MarketplaceSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header skeleton */}
      <div className="mb-8">
        <Skeleton className="h-10 w-64 mb-2" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Search skeleton */}
      <Skeleton className="h-16 rounded-xl mb-6" />

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-72 rounded-xl" />
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
