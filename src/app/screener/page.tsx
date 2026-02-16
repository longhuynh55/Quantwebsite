"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "DELISTED", label: "Delisted" },
];

const PHASE_OPTIONS = [
  { value: "", label: "All Phases" },
  { value: "HNX", label: "HNX" },
  { value: "HOSE", label: "HOSE" },
  { value: "UPCOM", label: "UPCOM" },
];

const PAGE_SIZE_OPTIONS = [
  { value: "25", label: "25 per page" },
  { value: "50", label: "50 per page" },
  { value: "100", label: "100 per page" },
];

export default function ScreenerPage() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
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

  const fetchStocks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stocks?limit=all");
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      setStocks(data.stocks || []);
      showSuccess("Data loaded", `Found ${data.stocks?.length || 0} stocks`);
    } catch (err) {
      console.error("Failed to fetch stocks:", err);
      const errorMessage = "Failed to load stock data. Please try again.";
      setError(errorMessage);
      showError("Loading failed", errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  const industryOptions = useMemo(() => {
    const industries = new Set<string>();
    for (const s of stocks) {
      if (s.icbName4 && s.icbName4.trim() !== "") {
        industries.add(s.icbName4.trim());
      }
    }

    const sorted = Array.from(industries).sort((a, b) => a.localeCompare(b));
    return [{ value: "", label: "All Industries" }, ...sorted.map((v) => ({ value: v, label: v }))];
  }, [stocks]);

  const filteredStocks = useMemo(() => {
    let result = stocks.filter((s) =>
      s.symbol.toLowerCase().includes(debouncedSearch.toLowerCase())
    );

    // Status filter
    if (statusFilter) {
      result = result.filter((s) => s.status === statusFilter);
    }

    // Phase filter
    if (phaseFilter) {
      result = result.filter((s) => s.listingPhase === phaseFilter);
    }

    // Volume range filter
    if (volumeMin) {
      const minVol = parseFloat(volumeMin);
      if (!isNaN(minVol)) {
        result = result.filter((s) => s.avgVolume >= minVol);
      }
    }
    if (volumeMax) {
      const maxVol = parseFloat(volumeMax);
      if (!isNaN(maxVol)) {
        result = result.filter((s) => s.avgVolume <= maxVol);
      }
    }

    // Trading days range filter
    if (daysMin) {
      const minDays = parseInt(daysMin);
      if (!isNaN(minDays)) {
        result = result.filter((s) => s.totalTradingDays >= minDays);
      }
    }
    if (daysMax) {
      const maxDays = parseInt(daysMax);
      if (!isNaN(maxDays)) {
        result = result.filter((s) => s.totalTradingDays <= maxDays);
      }
    }

    // Industry filter (ICB level 4)
    if (industryFilter) {
      result = result.filter((s) => (s.icbName4 || "") === industryFilter);
    }

    return result.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (typeof aVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }
      return sortDir === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [stocks, debouncedSearch, statusFilter, phaseFilter, volumeMin, volumeMax, daysMin, daysMax, industryFilter, sortBy, sortDir]);

  // Pagination
  const paginatedStocks = useMemo(() => {
    const size = parseInt(pageSize) || 50;
    const start = (currentPage - 1) * size;
    return filteredStocks.slice(start, start + size);
  }, [filteredStocks, currentPage, pageSize]);

  const pageSizeNum = parseInt(pageSize) || 50;
  const totalPages = Math.max(1, Math.ceil(filteredStocks.length / pageSizeNum));

  // Keep pagination stable when filters/page size reduce the number of pages.
  useEffect(() => {
    setCurrentPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, phaseFilter, volumeMin, volumeMax, daysMin, daysMax, industryFilter, pageSize]);

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
    setPhaseFilter("");
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
    phaseFilter !== "" ||
    volumeMin !== "" ||
    volumeMax !== "" ||
    daysMin !== "" ||
    daysMax !== "" ||
    industryFilter !== "";

  const activeFilterCount = [
    search,
    statusFilter,
    phaseFilter,
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

  const exportToCSV = () => {
    if (filteredStocks.length === 0) {
      showError("No data to export");
      return;
    }

    try {
      const headers = ["Symbol", "Status", "Avg Volume", "Trading Days", "Phase", "Industry"];
      const rows = filteredStocks.map((s) => [
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

      // Cleanup with delay to ensure download starts
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

      showSuccess("Export complete", `Exported ${filteredStocks.length} stocks to CSV`);
    } catch (err) {
      console.error("CSV Export error:", err);
      showError("Export failed", "Could not export CSV file");
    }
  };

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
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStocks}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              disabled={loading || filteredStocks.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
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
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Basic Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Symbol Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search symbols..."
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={STATUS_OPTIONS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Listing Phase
              </label>
              <Select
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value)}
                options={PHASE_OPTIONS}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Min Avg Volume
              </label>
              <Input
                type="number"
                value={volumeMin}
                onChange={(e) => setVolumeMin(e.target.value)}
                placeholder="e.g., 1000000"
              />
            </div>
          </div>

          {/* Advanced Filters */}
          {showAdvanced && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Avg Volume
                  </label>
                  <Input
                    type="number"
                    value={volumeMax}
                    onChange={(e) => setVolumeMax(e.target.value)}
                    placeholder="e.g., 10000000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Min Trading Days
                  </label>
                  <Input
                    type="number"
                    value={daysMin}
                    onChange={(e) => setDaysMin(e.target.value)}
                    placeholder="e.g., 100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Trading Days
                  </label>
                  <Input
                    type="number"
                    value={daysMax}
                    onChange={(e) => setDaysMax(e.target.value)}
                    placeholder="e.g., 5000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Industry (ICB)
                  </label>
                  <Select
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
          onRetry={fetchStocks}
          className="mb-6"
        />
      )}

      {/* Results */}
      {loading ? (
        <SkeletonTable rows={10} columns={7} />
      ) : error ? null : filteredStocks.length === 0 ? (
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
                  {paginatedStocks.map((stock) => (
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
      {!loading && !error && filteredStocks.length > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Showing {((currentPage - 1) * parseInt(pageSize)) + 1} to{" "}
            {Math.min(currentPage * parseInt(pageSize), filteredStocks.length)} of{" "}
            {filteredStocks.length} stocks
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
