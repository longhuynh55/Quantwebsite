"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { NoResultsState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/ui/page-transition";
import { StrategyCard, StrategyCardSkeleton } from "./StrategyCard";
import { StrategyDetail } from "./StrategyDetail";
import { StrategyImporter } from "./StrategyImporter";
import {
  generateMockStrategies,
  STRATEGY_TAGS,
  SORT_OPTIONS,
  type SharedStrategy,
  type StrategiesQueryParams,
} from "@/lib/community/strategy-service";
import {
  Search,
  SlidersHorizontal,
  X,
  Grid3X3,
  List,
  TrendingUp,
  Star,
  Download,
} from "lucide-react";

interface StrategyMarketplaceProps {
  className?: string;
}

type ViewMode = "grid" | "list";

export function StrategyMarketplace({ className }: StrategyMarketplaceProps) {
  // State
  const [strategies, setStrategies] = React.useState<SharedStrategy[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [sortBy, setSortBy] = React.useState<StrategiesQueryParams["sortBy"]>("date");
  const [sortOrder, setSortOrder] = React.useState<StrategiesQueryParams["sortOrder"]>("desc");

  // Pagination
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const pageSize = 12;

  // View
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");
  const [showFilters, setShowFilters] = React.useState(false);

  // Dialogs
  const [selectedStrategy, setSelectedStrategy] = React.useState<SharedStrategy | null>(null);
  const [showDetail, setShowDetail] = React.useState(false);
  const [showImporter, setShowImporter] = React.useState(false);
  const [strategyToImport, setStrategyToImport] = React.useState<SharedStrategy | null>(null);

  // Debounced search
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch strategies
  const loadStrategies = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // For development, use mock data
      // In production, replace with actual API call
      const mockData = generateMockStrategies(50);

      // Apply filters
      let filtered = [...mockData];

      // Search filter
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase();
        filtered = filtered.filter(
          (s) =>
            s.name.toLowerCase().includes(searchLower) ||
            s.description.toLowerCase().includes(searchLower) ||
            s.author.toLowerCase().includes(searchLower)
        );
      }

      // Tag filter
      if (selectedTags.length > 0) {
        filtered = filtered.filter((s) =>
          selectedTags.some((tag) => s.tags.includes(tag))
        );
      }

      // Sort
      filtered.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case "rating":
            comparison = a.rating - b.rating;
            break;
          case "return":
            comparison = a.performance.totalReturn - b.performance.totalReturn;
            break;
          case "downloads":
            comparison = a.downloads - b.downloads;
            break;
          case "date":
          default:
            comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
        }
        return sortOrder === "desc" ? -comparison : comparison;
      });

      // Pagination
      const totalItems = filtered.length;
      const pages = Math.ceil(totalItems / pageSize);
      const startIndex = (page - 1) * pageSize;
      const paginated = filtered.slice(startIndex, startIndex + pageSize);

      setStrategies(paginated);
      setTotal(totalItems);
      setTotalPages(pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load strategies");
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, selectedTags, sortBy, sortOrder, page]);

  // Load on mount and when filters change
  React.useEffect(() => {
    loadStrategies();
  }, [loadStrategies]);

  // Reset page when filters change
  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedTags, sortBy, sortOrder]);

  // Handlers
  const handleViewDetails = (strategy: SharedStrategy) => {
    setSelectedStrategy(strategy);
    setShowDetail(true);
  };

  const handleCopy = (strategy: SharedStrategy) => {
    setStrategyToImport(strategy);
    setShowImporter(true);
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTags([]);
    setSortBy("date");
    setSortOrder("desc");
  };

  const hasActiveFilters = searchQuery || selectedTags.length > 0;

  // Stats summary
  const stats = React.useMemo(() => {
    if (strategies.length === 0) return null;

    const avgReturn = strategies.reduce((sum, s) => sum + s.performance.totalReturn, 0) / strategies.length;
    const avgRating = strategies.reduce((sum, s) => sum + s.rating, 0) / strategies.length;
    const totalDownloads = strategies.reduce((sum, s) => sum + s.downloads, 0);

    return { avgReturn, avgRating, totalDownloads };
  }, [strategies]);

  return (
    <PageTransition variant="fade" className={cn("min-h-screen", className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Strategy Community
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Discover and share high-quality trading strategies from the community
          </p>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Avg Return</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">
                  +{stats.avgReturn.toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                <Star className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Avg Rating</p>
                <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                  {stats.avgRating.toFixed(1)}/5
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Downloads</p>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {stats.totalDownloads.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search and filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
          {/* Main search row */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search input */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search strategies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sort select */}
            <div className="flex gap-2">
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as StrategiesQueryParams["sortBy"])}
                options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.labelEn }))}
                className="w-48"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                aria-label={sortOrder === "asc" ? "Ascending" : "Descending"}
              >
                {sortOrder === "asc" ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingUp className="w-4 h-4 rotate-180" />
                )}
              </Button>
            </div>

            {/* Filter toggle */}
            <Button
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {selectedTags.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {selectedTags.length}
                </Badge>
              )}
            </Button>

            {/* View toggle */}
            <div className="flex gap-1">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
                aria-label="List view"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Expanded filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Strategy categories
                </h3>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {STRATEGY_TAGS.map((tag) => (
                  <button
                    key={tag.value}
                    onClick={() => handleTagToggle(tag.value)}
                    aria-pressed={selectedTags.includes(tag.value)}
                    aria-label={selectedTags.includes(tag.value) ? `Unselect ${tag.label}` : `Select ${tag.label}`}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                      selectedTags.includes(tag.value)
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-300 dark:border-blue-700"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    )}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isLoading ? (
              "Loading..."
            ) : (
              <>
                {total.toLocaleString()} strategies
                {hasActiveFilters && " matching filters"}
              </>
            )}
          </p>
        </div>

        {/* Content */}
        {error ? (
          <NoResultsState
            title="Data loading error"
            description={error}
            action={
              <Button variant="outline" onClick={loadStrategies}>
                Try again
              </Button>
            }
          />
        ) : isLoading ? (
          <div
            className={cn(
              "grid gap-6",
              viewMode === "grid"
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                : "grid-cols-1"
            )}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <StrategyCardSkeleton key={i} compact={viewMode === "list"} />
            ))}
          </div>
        ) : strategies.length === 0 ? (
          <NoResultsState
            title="No strategies found"
            description={hasActiveFilters ? "Try adjusting filters to see more results." : undefined}
            action={
              hasActiveFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div
            className={cn(
              "grid gap-6",
              viewMode === "grid"
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                : "grid-cols-1"
            )}
          >
            {strategies.map((strategy) => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                onViewDetails={handleViewDetails}
                onCopy={handleCopy}
                compact={viewMode === "list"}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }

              return (
                <Button
                  key={pageNum}
                  variant={page === pageNum ? "default" : "outline"}
                  onClick={() => setPage(pageNum)}
                  className="w-10"
                >
                  {pageNum}
                </Button>
              );
            })}

            <Button
              variant="outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Strategy Detail Dialog */}
      <StrategyDetail
        strategy={selectedStrategy}
        open={showDetail}
        onOpenChange={setShowDetail}
        onCopy={handleCopy}
      />

      {/* Strategy Importer Dialog */}
      <StrategyImporter
        strategy={strategyToImport}
        open={showImporter}
        onOpenChange={setShowImporter}
      />
    </PageTransition>
  );
}

