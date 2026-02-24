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
      if (query.trim()) params.set("search", query.trim());
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
    setQuery(searchInput.trim());
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
    if (query.trim()) chips.push({ id: "query", label: `Search: ${query.trim()}` });
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
    <div className="max-w-full space-y-5">
      <div className="overflow-hidden border border-stone-200 bg-gradient-to-r from-stone-50 to-stone-100/60 dark:border-neutral-800 dark:from-neutral-950 dark:to-neutral-900">
        <div className="h-1 bg-emerald-700 dark:bg-emerald-600" />
        <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-px w-8 bg-emerald-700 dark:bg-emerald-500" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-neutral-500">
                Workspace
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center border border-emerald-200 bg-white text-emerald-700 dark:border-emerald-900 dark:bg-neutral-900 dark:text-emerald-400">
                <Search className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-serif text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
                  Stock Screener
                </h1>
                <p className="text-sm text-stone-600 dark:text-neutral-400">
                  Filter and rank HOSE symbols by liquidity, listing status, and trading history.
                </p>
              </div>
            </div>
          </div>
          <Link href="/charts">
            <Button
              variant="outline"
              className="gap-2 border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600"
            >
              Open Chart Workspace
              <ExternalLink className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden border-stone-200 bg-white/95 dark:border-neutral-800 dark:bg-neutral-950">
        <CardHeader className="border-b border-stone-200 bg-stone-50/80 pb-4 dark:border-neutral-800 dark:bg-neutral-900/70">
          <CardTitle className="flex items-center gap-2 font-serif text-lg text-stone-900 dark:text-white">
            <Search className="w-4 h-4 text-emerald-700 dark:text-emerald-500" />
            Universe Filters
          </CardTitle>
          <CardDescription className="text-stone-600 dark:text-neutral-400">
            Search by symbol, company, or industry then refine with status, sector, and liquidity range.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <div className="border border-stone-200 bg-stone-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/70">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500 dark:text-neutral-500">
                Search
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Type symbol/company (e.g., FPT, Vinamilk, Banking)"
                  ariaLabel="Search symbol, company, or industry"
                  maxLength={80}
                />
                <Button
                  onClick={handleSearch}
                  className="w-full bg-emerald-700 text-white hover:bg-emerald-800 sm:w-auto dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  Search
                </Button>
              </div>
            </div>

            <div className="border border-stone-200 bg-stone-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/70">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500 dark:text-neutral-500">
                Rank & Status
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
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
              </div>
            </div>

            <div className="border border-stone-200 bg-stone-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/70">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500 dark:text-neutral-500">
                Sector & Liquidity
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
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
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-stone-200 pt-3 dark:border-neutral-800">
            <Button
              variant="outline"
              onClick={handleExportCsv}
              disabled={exporting || loading}
              className="gap-2 border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600"
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
              className="border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          {activeFilterChips.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border border-stone-200 bg-stone-50/70 p-2 dark:border-neutral-800 dark:bg-neutral-900/70">
              {activeFilterChips.map((chip) => (
                <Badge
                  key={chip.id}
                  variant="secondary"
                  className="inline-flex items-center gap-1 border border-emerald-100 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200"
                >
                  {chip.label}
                  <button
                    type="button"
                    onClick={() => clearFilterChip(chip.id)}
                    aria-label={`Remove ${chip.label} filter`}
                    className="hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="text-stone-600 hover:bg-stone-200/80 hover:text-stone-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
              >
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
          description="Try a broader keyword query or reset status/sort filters."
        />
      ) : (
        <Card className="overflow-hidden border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
          <CardHeader className="border-b border-stone-200 bg-stone-50/80 pb-3 dark:border-neutral-800 dark:bg-neutral-900/70">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <CardTitle className="flex items-center gap-2 font-serif text-lg text-stone-900 dark:text-white">
                <ArrowUpDown className="w-4 h-4 text-emerald-700 dark:text-emerald-500" />
                Screened Universe
              </CardTitle>
              <Badge variant="outline" className="border-stone-300 text-stone-700 dark:border-neutral-700 dark:text-neutral-300">
                {pageLabel}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-stone-200 dark:border-neutral-800">
                  <tr>
                    <th className="py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-neutral-500">Symbol</th>
                    <th className="py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-neutral-500">Company</th>
                    <th className="py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-neutral-500">Industry</th>
                    <th className="py-2 text-right text-xs font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-neutral-500">Avg Volume</th>
                    <th className="py-2 text-right text-xs font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-neutral-500">Trading Days</th>
                    <th className="py-2 text-right text-xs font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-neutral-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-neutral-800">
                  {rows.map((stock) => (
                    <tr key={stock.symbol} className="hover:bg-stone-50 dark:hover:bg-neutral-900/40">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-stone-900 dark:text-neutral-100">{stock.symbol}</span>
                          <Badge variant={stock.status === "ACTIVE" ? "success" : "secondary"}>
                            {stock.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-2.5 text-stone-700 dark:text-neutral-300">
                        <span className="line-clamp-1" title={stock.organName || "-"}>
                          {stock.organName || "-"}
                        </span>
                      </td>
                      <td className="py-2.5 text-stone-700 dark:text-neutral-300">
                        <span className="line-clamp-1" title={stock.icbName4 || "-"}>
                          {stock.icbName4 || "-"}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-mono text-stone-900 dark:text-neutral-100">
                        {formatCurrency(stock.avgVolume)}
                      </td>
                      <td className="py-2.5 text-right font-mono text-stone-900 dark:text-neutral-100">
                        {stock.totalTradingDays.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right">
                        <Link href={`/charts?symbol=${stock.symbol}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600"
                          >
                            Analyze
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-stone-200 pt-4 dark:border-neutral-800">
              <p className="text-xs text-stone-500 dark:text-neutral-400">Page {page} of {totalPages}</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600"
                  disabled={page <= 1}
                  onClick={() => setPage(Math.max(1, page - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-stone-300 bg-white text-stone-700 hover:border-stone-400 hover:bg-stone-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-neutral-600"
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
