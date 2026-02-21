"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useUrlState } from "@/lib/hooks";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Button,
  Badge,
  NoResultsState,
  ErrorState,
  SkeletonTable,
} from "@/components/ui";
import { Search, ArrowUpDown, RefreshCw, ExternalLink, Download, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ScreenerStock {
  symbol: string;
  status: string;
  listingPhase: string;
  avgVolume: number;
  totalTradingDays: number;
  icbName4?: string;
  organName?: string;
}

interface ScreenerResponse {
  stocks: ScreenerStock[];
  total: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

const PAGE_SIZE = 25;

type ActiveFilterChip = {
  id: "query" | "status" | "sector" | "liquidity";
  label: string;
};

function formatChipNumber(raw: string): string {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed.toLocaleString() : raw;
}

export default function ScreenerClient() {
  const [query, setQuery] = useUrlState<string>("q", "");
  const [sortBy, setSortBy] = useUrlState<string>("sortBy", "avgVolume");
  const [sortDir, setSortDir] = useUrlState<string>("sortDir", "desc");
  const [status, setStatus] = useUrlState<string>("status", "");
  const [sector, setSector] = useUrlState<string>("sector", "");
  const [minLiquidity, setMinLiquidity] = useUrlState<string>("minLiquidity", "");
  const [maxLiquidity, setMaxLiquidity] = useUrlState<string>("maxLiquidity", "");
  const [page, setPage] = useUrlState<number>("page", 1);
  const [searchInput, setSearchInput] = useState(query);

  const [rows, setRows] = useState<ScreenerStock[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  const buildScreenerParams = useCallback(
    (options?: { csv?: boolean }) => {
      const params = new URLSearchParams();
      if (options?.csv) {
        params.set("limit", "all");
        params.set("format", "csv");
      } else {
        params.set("page", String(Math.max(1, page)));
        params.set("pageSize", String(PAGE_SIZE));
      }
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
      if (query.trim()) params.set("search", query.trim().toUpperCase());
      if (status) params.set("status", status);
      if (sector.trim()) params.set("sector", sector.trim());
      if (minLiquidity.trim()) params.set("minLiquidity", minLiquidity.trim());
      if (maxLiquidity.trim()) params.set("maxLiquidity", maxLiquidity.trim());
      return params;
    },
    [page, query, sortBy, sortDir, status, sector, minLiquidity, maxLiquidity]
  );

  const fetchStocks = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError(null);

      try {
        const params = buildScreenerParams();
        const response = await fetch(`/api/stocks?${params.toString()}`, { signal });
        const result: ScreenerResponse & { error?: string } = await response.json();
        if (!response.ok) {
          throw new Error(result.error || `HTTP ${response.status}`);
        }

        setRows(Array.isArray(result.stocks) ? result.stocks : []);
        setTotal(typeof result.total === "number" ? result.total : 0);
        setTotalPages(Math.max(1, result.totalPages ?? 1));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        setError(err instanceof Error ? err.message : "Failed to load screener data.");
      } finally {
        setLoading(false);
      }
    },
    [buildScreenerParams]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchStocks(controller.signal);
    return () => controller.abort();
  }, [fetchStocks]);

  const handleSearch = useCallback(() => {
    setPage(1);
    setQuery(searchInput.trim().toUpperCase());
  }, [searchInput, setPage, setQuery]);

  const handleSortBy = useCallback(
    (nextSortBy: string) => {
      setPage(1);
      setSortBy(nextSortBy);
    },
    [setPage, setSortBy]
  );

  const handleSortDir = useCallback(
    (nextSortDir: string) => {
      setPage(1);
      setSortDir(nextSortDir);
    },
    [setPage, setSortDir]
  );

  const handleStatus = useCallback(
    (nextStatus: string) => {
      setPage(1);
      setStatus(nextStatus);
    },
    [setPage, setStatus]
  );

  const handleSector = useCallback(
    (nextSector: string) => {
      setPage(1);
      setSector(nextSector);
    },
    [setPage, setSector]
  );

  const handleMinLiquidity = useCallback(
    (nextMinLiquidity: string) => {
      setPage(1);
      setMinLiquidity(nextMinLiquidity);
    },
    [setPage, setMinLiquidity]
  );

  const handleMaxLiquidity = useCallback(
    (nextMaxLiquidity: string) => {
      setPage(1);
      setMaxLiquidity(nextMaxLiquidity);
    },
    [setPage, setMaxLiquidity]
  );

  const activeFilterChips = useMemo(() => {
    const chips: ActiveFilterChip[] = [];
    if (query.trim()) chips.push({ id: "query", label: `Symbol: ${query.trim()}` });
    if (status) chips.push({ id: "status", label: `Status: ${status}` });
    if (sector.trim()) chips.push({ id: "sector", label: `Sector: ${sector.trim()}` });
    if (minLiquidity.trim() || maxLiquidity.trim()) {
      const minLabel = minLiquidity.trim() ? formatChipNumber(minLiquidity.trim()) : "";
      const maxLabel = maxLiquidity.trim() ? formatChipNumber(maxLiquidity.trim()) : "";
      const liquidityLabel = minLabel && maxLabel
        ? `Liquidity: ${minLabel} - ${maxLabel}`
        : minLabel
          ? `Liquidity >= ${minLabel}`
          : `Liquidity <= ${maxLabel}`;
      chips.push({ id: "liquidity", label: liquidityLabel });
    }
    return chips;
  }, [query, status, sector, minLiquidity, maxLiquidity]);

  const clearFilterChip = useCallback(
    (chipId: ActiveFilterChip["id"]) => {
      setPage(1);
      if (chipId === "query") {
        setQuery("");
        setSearchInput("");
        return;
      }
      if (chipId === "status") {
        setStatus("");
        return;
      }
      if (chipId === "sector") {
        setSector("");
        return;
      }
      setMinLiquidity("");
      setMaxLiquidity("");
    },
    [setPage, setQuery, setSearchInput, setStatus, setSector, setMinLiquidity, setMaxLiquidity]
  );

  const clearAllFilters = useCallback(() => {
    setPage(1);
    setQuery("");
    setSearchInput("");
    setStatus("");
    setSector("");
    setMinLiquidity("");
    setMaxLiquidity("");
  }, [setPage, setQuery, setSearchInput, setStatus, setSector, setMinLiquidity, setMaxLiquidity]);

  const handleExportCsv = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const params = buildScreenerParams({ csv: true });
      const response = await fetch(`/api/stocks?${params.toString()}`, {
        headers: { Accept: "text/csv" },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const contentDisposition = response.headers.get("content-disposition");
      const fileNameMatch = contentDisposition?.match(/filename="?([^";]+)"?/i);
      anchor.href = url;
      anchor.download = fileNameMatch?.[1] || `stocks-screener-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export screener CSV.");
    } finally {
      setExporting(false);
    }
  }, [buildScreenerParams]);

  const pageLabel = useMemo(() => {
    const currentPage = Math.max(1, page);
    const from = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const to = Math.min(total, currentPage * PAGE_SIZE);
    return `${from}-${to} of ${total.toLocaleString()}`;
  }, [page, total]);

  return (
    <div className="max-w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Stock Screener</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Filter and rank HOSE symbols by liquidity, listing status, and trading history.
          </p>
        </div>
        <Link href="/charts">
          <Button variant="outline" className="gap-2">
            Open Chart Workspace
            <ExternalLink className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-600" />
            Universe Filters
          </CardTitle>
          <CardDescription>Search by symbol and refine status, sector, and liquidity range.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_170px_160px_160px_220px_150px_150px_auto] gap-3">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Type a symbol (e.g., FPT, VNM)"
              ariaLabel="Search stock symbol"
              maxLength={10}
            />
            <Select
              value={sortBy}
              onChange={(e) => handleSortBy(e.target.value)}
              ariaLabel="Sort field"
              options={[
                { value: "avgVolume", label: "Average Volume" },
                { value: "totalTradingDays", label: "Trading Days" },
                { value: "symbol", label: "Symbol" },
                { value: "icbName4", label: "Industry" },
                { value: "status", label: "Status" },
              ]}
            />
            <Select
              value={sortDir}
              onChange={(e) => handleSortDir(e.target.value)}
              ariaLabel="Sort direction"
              options={[
                { value: "desc", label: "Descending" },
                { value: "asc", label: "Ascending" },
              ]}
            />
            <Select
              value={status}
              onChange={(e) => handleStatus(e.target.value)}
              ariaLabel="Status filter"
              options={[
                { value: "", label: "All Statuses" },
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
                { value: "SUSPENDED", label: "Suspended" },
              ]}
            />
            <Input
              value={sector}
              onChange={(e) => handleSector(e.target.value)}
              placeholder="Sector (e.g., Banking)"
              ariaLabel="Sector filter"
            />
            <Input
              type="number"
              min={0}
              step={1}
              value={minLiquidity}
              onChange={(e) => handleMinLiquidity(e.target.value)}
              placeholder="Min liquidity"
              ariaLabel="Minimum liquidity"
            />
            <Input
              type="number"
              min={0}
              step={1}
              value={maxLiquidity}
              onChange={(e) => handleMaxLiquidity(e.target.value)}
              placeholder="Max liquidity"
              ariaLabel="Maximum liquidity"
            />
            <div className="flex gap-2">
              <Button onClick={handleSearch} className="w-full lg:w-auto">
                Search
              </Button>
              <Button
                variant="outline"
                onClick={handleExportCsv}
                disabled={exporting || loading}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                {exporting ? "Exporting..." : "Export CSV"}
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Refresh screener data"
                onClick={() => {
                  const controller = new AbortController();
                  fetchStocks(controller.signal);
                }}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
          {activeFilterChips.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {activeFilterChips.map((chip) => (
                <Badge key={chip.id} variant="secondary" className="inline-flex items-center gap-1">
                  {chip.label}
                  <button
                    type="button"
                    onClick={() => clearFilterChip(chip.id)}
                    aria-label={`Remove ${chip.label} filter`}
                    className="rounded-sm hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                Clear all
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {error ? (
        <ErrorState
          message="Screener data unavailable"
          description={error}
          onRetry={() => {
            const controller = new AbortController();
            fetchStocks(controller.signal);
          }}
        />
      ) : loading ? (
        <SkeletonTable rows={10} columns={6} />
      ) : rows.length === 0 ? (
        <NoResultsState
          title="No symbols matched your filters"
          description="Try a broader symbol query or reset status/sort filters."
        />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-gray-500" />
                Screened Universe
              </CardTitle>
              <Badge variant="outline">{pageLabel}</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Symbol</th>
                    <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Company</th>
                    <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Industry</th>
                    <th className="py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Avg Volume</th>
                    <th className="py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Trading Days</th>
                    <th className="py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.map((stock) => (
                    <tr key={stock.symbol} className="hover:bg-gray-50 dark:hover:bg-slate-900/40">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{stock.symbol}</span>
                          <Badge variant={stock.status === "ACTIVE" ? "success" : "secondary"}>
                            {stock.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-2.5 text-gray-700 dark:text-gray-300">
                        <span className="line-clamp-1" title={stock.organName || "-"}>
                          {stock.organName || "-"}
                        </span>
                      </td>
                      <td className="py-2.5 text-gray-700 dark:text-gray-300">
                        <span className="line-clamp-1" title={stock.icbName4 || "-"}>
                          {stock.icbName4 || "-"}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-mono text-gray-900 dark:text-gray-100">
                        {formatCurrency(stock.avgVolume)}
                      </td>
                      <td className="py-2.5 text-right font-mono text-gray-900 dark:text-gray-100">
                        {stock.totalTradingDays.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right">
                        <Link href={`/charts?symbol=${stock.symbol}`}>
                          <Button variant="outline" size="sm">
                            Analyze
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(Math.max(1, page - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
