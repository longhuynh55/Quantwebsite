"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Badge,
  Select,
  SkeletonTable,
  NoResultsState,
  ErrorState,
  PageTransition,
} from "@/components/ui";
import { showSuccess, showError } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { useDebounce } from "@/lib/hooks";
import { useAssistantStore } from "@/lib/stores/assistantStore";
import { Search, Filter, ArrowUpDown, RefreshCw, Download, ChevronLeft, ChevronRight, X } from "lucide-react";

interface Stock {
  symbol: string;
  status: string;
  avgVolume: number;
  totalTradingDays: number;
  listingPhase: string;
  organName?: string;
  icbName4?: string;
}

interface StocksApiResponse {
  stocks?: Stock[];
  total?: number;
}

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "DELISTED", label: "Delisted" },
];

const PHASE_OPTIONS = [
  { value: "HOSE", label: "HOSE" },
];

const PAGE_SIZE_OPTIONS = [
  { value: "25", label: "25 per page" },
  { value: "50", label: "50 per page" },
  { value: "100", label: "100 per page" },
];

export default function ScreenerPage() {
  const { setUIMode, setContext, closePanel } = useAssistantStore();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [totalStocks, setTotalStocks] = useState(0);
  const [industryOptions, setIndustryOptions] = useState<Array<{ value: string; label: string }>>([
    { value: "", label: "All Industries" },
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("HOSE");
  const [volumeMin, setVolumeMin] = useState("");
  const [volumeMax, setVolumeMax] = useState("");
  const [daysMin, setDaysMin] = useState("");
  const [daysMax, setDaysMax] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");

  // Debounce search for performance
  const debouncedSearch = useDebounce(search, 300);

  // Sort and pagination
  const [sortBy, setSortBy] = useState<keyof Stock>("symbol");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState("50");

  // Advanced filters toggle
  const [showAdvanced, setShowAdvanced] = useState(false);
  const advancedFiltersRef = useRef<HTMLDivElement>(null);

  const buildQueryParams = useCallback((options?: { exportAll?: boolean }) => {
    const params = new URLSearchParams();

    if (debouncedSearch) {
      params.set("search", debouncedSearch.trim().toUpperCase());
    }
    if (statusFilter) {
      params.set("status", statusFilter);
    }
    if (phaseFilter) {
      params.set("listingPhase", phaseFilter);
    }
    if (volumeMin) {
      params.set("minAvgVolume", volumeMin);
    }
    if (volumeMax) {
      params.set("maxAvgVolume", volumeMax);
    }
    if (daysMin) {
      params.set("minTradingDays", daysMin);
    }
    if (daysMax) {
      params.set("maxTradingDays", daysMax);
    }
    if (industryFilter) {
      params.set("industry", industryFilter);
    }

    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);

    if (options?.exportAll) {
      params.set("limit", "all");
    } else {
      params.set("page", String(currentPage));
      params.set("pageSize", pageSize);
    }

    return params;
  }, [
    debouncedSearch,
    statusFilter,
    phaseFilter,
    volumeMin,
    volumeMax,
    daysMin,
    daysMax,
    industryFilter,
    sortBy,
    sortDir,
    currentPage,
    pageSize,
  ]);

  const fetchStocks = useCallback(async ({ notify = false }: { notify?: boolean } = {}) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/stocks?${buildQueryParams().toString()}`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data: StocksApiResponse = await res.json();
      setStocks(Array.isArray(data.stocks) ? data.stocks : []);
      setTotalStocks(typeof data.total === "number" ? data.total : 0);

      if (notify) {
        showSuccess("Data loaded", `Found ${data.total || 0} matching stocks`);
      }
    } catch (err) {
      console.error("Failed to fetch stocks:", err);
      setStocks([]);
      setTotalStocks(0);
      const errorMessage = "Failed to load stock data. Please try again.";
      setError(errorMessage);
      showError("Loading failed", errorMessage);
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams]);

  const fetchIndustryOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/stocks?listingPhase=HOSE&sortBy=icbName4&sortDir=asc&limit=all");
      if (!res.ok) return;

      const data: StocksApiResponse = await res.json();
      const industries = new Set<string>();
      for (const stock of data.stocks || []) {
        if (typeof stock.icbName4 === "string" && stock.icbName4.trim() !== "") {
          industries.add(stock.icbName4.trim());
        }
      }

      const sorted = Array.from(industries).sort((a, b) => a.localeCompare(b));
      setIndustryOptions([
        { value: "", label: "All Industries" },
        ...sorted.map((value) => ({ value, label: value })),
      ]);
    } catch (err) {
      console.warn("Failed to load industry options:", err);
    }
  }, []);

  useEffect(() => {
    setUIMode("screener");
    setContext({ page: "screener" });
    closePanel();
  }, [setUIMode, setContext, closePanel]);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  useEffect(() => {
    fetchIndustryOptions();
  }, [fetchIndustryOptions]);

  const pageSizeNum = parseInt(pageSize, 10) || 50;
  const totalPages = Math.max(1, Math.ceil(totalStocks / pageSizeNum));

  // Keep pagination stable when result set changes.
  useEffect(() => {
    setCurrentPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  // Reset to first page when filters/sort change.
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, phaseFilter, volumeMin, volumeMax, daysMin, daysMax, industryFilter, sortBy, sortDir, pageSize]);

  useEffect(() => {
    if (!showAdvanced) return;
    const timer = window.setTimeout(() => {
      const firstField = advancedFiltersRef.current?.querySelector<HTMLInputElement>("input, select, textarea, button");
      firstField?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [showAdvanced]);

  const handleSort = (key: keyof Stock) => {
    if (sortBy === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setPhaseFilter("HOSE");
    setVolumeMin("");
    setVolumeMax("");
    setDaysMin("");
    setDaysMax("");
    setIndustryFilter("");
    setCurrentPage(1);
    showSuccess("Filters cleared");
  };

  const hasActiveFilters =
    search !== "" ||
    statusFilter !== "" ||
    volumeMin !== "" ||
    volumeMax !== "" ||
    daysMin !== "" ||
    daysMax !== "" ||
    industryFilter !== "";

  const activeFilterCount = [
    search,
    statusFilter,
    volumeMin,
    volumeMax,
    daysMin,
    daysMax,
    industryFilter,
  ].filter((v) => v !== "").length;

  // Helper function to escape CSV values
  const escapeCSV = (value: string | number): string => {
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const exportToCSV = async () => {
    try {
      const exportParams = buildQueryParams({ exportAll: true });
      const res = await fetch(`/api/stocks?${exportParams.toString()}`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data: StocksApiResponse = await res.json();
      const exportStocks = Array.isArray(data.stocks) ? data.stocks : [];
      if (exportStocks.length === 0) {
        showError("No data to export");
        return;
      }

      const headers = ["Symbol", "Status", "Avg Volume", "Trading Days", "Phase", "Industry"];
      const rows = exportStocks.map((s) => [
        escapeCSV(s.symbol),
        escapeCSV(s.status || ""),
        escapeCSV(s.avgVolume?.toString() || "0"),
        escapeCSV(s.totalTradingDays?.toString() || "0"),
        escapeCSV(s.listingPhase || ""),
        escapeCSV(s.icbName4 || ""),
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((r) => r.join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `screener_results_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

      showSuccess("Export complete", `Exported ${exportStocks.length} stocks to CSV`);
    } catch (err) {
      console.error("CSV Export error:", err);
      showError("Export failed", "Could not export CSV file");
    }
  };

  const showingFrom = totalStocks === 0 ? 0 : ((currentPage - 1) * pageSizeNum) + 1;
  const showingTo = totalStocks === 0 ? 0 : Math.min(currentPage * pageSizeNum, totalStocks);

  return (
    <PageTransition variant="slideUp">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Stock Screener
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Filter and sort HOSE stocks by various criteria
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchStocks({ notify: true })}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              disabled={loading || totalStocks === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-gray-900 dark:text-white">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="default" className="ml-2">
                    {activeFilterCount} active
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-gray-600 dark:text-gray-400"
                  aria-expanded={showAdvanced}
                  aria-controls="advanced-filters"
                >
                  {showAdvanced ? "Hide" : "Show"} Advanced
                </Button>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>
              <span className="sr-only" aria-live="polite">
                {showAdvanced ? "Advanced filters shown" : "Advanced filters hidden"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Basic Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label htmlFor="screener-symbol-search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Symbol Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="screener-symbol-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search symbols..."
                    className="pl-9"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="screener-status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <Select
                  id="screener-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={STATUS_OPTIONS}
                />
              </div>
              <div>
                <label htmlFor="screener-listing-phase" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Listing Phase
                </label>
                <Select
                  id="screener-listing-phase"
                  value={phaseFilter}
                  onChange={(e) => setPhaseFilter(e.target.value)}
                  options={PHASE_OPTIONS}
                />
              </div>
              <div>
                <label htmlFor="screener-min-volume" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Avg Volume
                </label>
                <Input
                  id="screener-min-volume"
                  type="number"
                  value={volumeMin}
                  onChange={(e) => setVolumeMin(e.target.value)}
                  placeholder="e.g., 1000000"
                />
              </div>
            </div>

            {/* Advanced Filters */}
            {showAdvanced && (
              <div
                id="advanced-filters"
                ref={advancedFiltersRef}
                role="region"
                aria-label="Advanced screener filters"
                aria-live="polite"
                className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
              >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="screener-max-volume" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Max Avg Volume
                    </label>
                    <Input
                      id="screener-max-volume"
                      type="number"
                      value={volumeMax}
                      onChange={(e) => setVolumeMax(e.target.value)}
                      placeholder="e.g., 10000000"
                    />
                  </div>
                  <div>
                    <label htmlFor="screener-min-days" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Min Trading Days
                    </label>
                    <Input
                      id="screener-min-days"
                      type="number"
                      value={daysMin}
                      onChange={(e) => setDaysMin(e.target.value)}
                      placeholder="e.g., 100"
                    />
                  </div>
                  <div>
                    <label htmlFor="screener-max-days" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Max Trading Days
                    </label>
                    <Input
                      id="screener-max-days"
                      type="number"
                      value={daysMax}
                      onChange={(e) => setDaysMax(e.target.value)}
                      placeholder="e.g., 5000"
                    />
                  </div>
                  <div>
                    <label htmlFor="screener-industry" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Industry (ICB)
                    </label>
                    <Select
                      id="screener-industry"
                      value={industryFilter}
                      onChange={(e) => setIndustryFilter(e.target.value)}
                      options={industryOptions}
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error State */}
        {error && !loading && (
          <ErrorState
            message="Failed to load data"
            description={error}
            onRetry={() => fetchStocks({ notify: true })}
            className="mb-6"
          />
        )}

        {/* Results */}
        {loading ? (
          <SkeletonTable rows={10} columns={7} />
        ) : error ? null : stocks.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <NoResultsState
                title="No stocks found"
                description={
                  hasActiveFilters
                    ? "Try adjusting your filters to see more results."
                    : "No stock data is currently available."
                }
                onClear={hasActiveFilters ? clearFilters : undefined}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <button
                          className="flex items-center font-medium text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                          onClick={() => handleSort("symbol")}
                        >
                          Symbol <ArrowUpDown className="w-4 h-4 ml-1" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          className="flex items-center font-medium text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                          onClick={() => handleSort("status")}
                        >
                          Status <ArrowUpDown className="w-4 h-4 ml-1" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right">
                        <button
                          className="flex items-center font-medium text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white ml-auto"
                          onClick={() => handleSort("avgVolume")}
                        >
                          Avg Volume <ArrowUpDown className="w-4 h-4 ml-1" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right">
                        <button
                          className="flex items-center font-medium text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white ml-auto"
                          onClick={() => handleSort("totalTradingDays")}
                        >
                          Trading Days <ArrowUpDown className="w-4 h-4 ml-1" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left">
                        <button
                          className="flex items-center font-medium text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                          onClick={() => handleSort("listingPhase")}
                        >
                          Phase <ArrowUpDown className="w-4 h-4 ml-1" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-left text-gray-600 dark:text-gray-300">
                        Industry
                      </th>
                      <th className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {stocks.map((stock) => (
                      <tr
                        key={stock.symbol}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {stock.symbol}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={stock.status === "ACTIVE" ? "success" : "secondary"}
                          >
                            {stock.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                          {formatCurrency(stock.avgVolume)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                          {stock.totalTradingDays.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">{stock.listingPhase}</Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                          {stock.icbName4 ? (
                            <span className="line-clamp-1" title={stock.icbName4}>
                              {stock.icbName4}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">N/A</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link href={`/charts?symbol=${stock.symbol}`}>
                            <Button size="sm" variant="outline">
                              Chart
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {!loading && !error && totalStocks > 0 && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Showing {showingFrom} to {showingTo} of {totalStocks} stocks
            </div>
            <div className="flex items-center gap-4">
              <Select
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value)}
                options={PAGE_SIZE_OPTIONS}
                className="w-36"
              />
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2"
                  aria-label="Go to first page"
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2"
                  aria-label="Go to previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2"
                  aria-label="Go to next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2"
                  aria-label="Go to last page"
                >
                  Last
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
