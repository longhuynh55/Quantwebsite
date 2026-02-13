"use client";

import * as React from "react";
import { CommandDialog } from "cmdk";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  LineChart,
  TrendingUp,
  PieChart,
  BarChart3,
  Shield,
  Brain,
  BookOpen,
  CandlestickChart,
  Sparkles,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  group: string;
}

interface StockResult {
  symbol: string;
  name?: string;
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [stocks, setStocks] = React.useState<StockResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  // Keyboard shortcut to open
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Fetch stocks when searching
  React.useEffect(() => {
    if (!searchQuery || searchQuery.length < 1) {
      setStocks([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    // Show spinner while we debounce + fetch.
    setLoading(true);

    const fetchStocks = async () => {
      try {
        const query = searchQuery;
        const res = await fetch(`/api/stocks?search=${encodeURIComponent(query)}&limit=5`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          if (active) setStocks([]);
          return;
        }

        const data = await res.json();
        if (!active) return;
        setStocks(data.stocks?.map((s: { symbol: string }) => ({ symbol: s.symbol })) || []);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (active) setStocks([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    const timeout = setTimeout(fetchStocks, 200);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [searchQuery]);

  const navigationCommands: CommandItem[] = [
    {
      id: "home",
      label: "Home",
      icon: <LayoutDashboard className="w-4 h-4" />,
      action: () => router.push("/"),
      group: "Navigation",
    },
    {
      id: "screener",
      label: "Stock Screener",
      icon: <Search className="w-4 h-4" />,
      shortcut: "G S",
      action: () => router.push("/screener"),
      group: "Navigation",
    },
    {
      id: "charts",
      label: "Charts",
      icon: <TrendingUp className="w-4 h-4" />,
      shortcut: "G C",
      action: () => router.push("/charts"),
      group: "Navigation",
    },
    {
      id: "backtesting",
      label: "Backtesting",
      icon: <LineChart className="w-4 h-4" />,
      shortcut: "G B",
      action: () => router.push("/backtesting"),
      group: "Portfolio",
    },
    {
      id: "portfolio",
      label: "Portfolio Optimization",
      icon: <PieChart className="w-4 h-4" />,
      action: () => router.push("/portfolio"),
      group: "Portfolio",
    },
    {
      id: "factors",
      label: "Factor Analysis",
      icon: <BarChart3 className="w-4 h-4" />,
      action: () => router.push("/factors"),
      group: "Portfolio",
    },
    {
      id: "risk",
      label: "Risk Management",
      icon: <Shield className="w-4 h-4" />,
      action: () => router.push("/risk"),
      group: "Portfolio",
    },
    {
      id: "ml-lab",
      label: "ML Lab",
      icon: <Brain className="w-4 h-4" />,
      action: () => router.push("/ml-lab"),
      group: "Portfolio",
    },
    {
      id: "learn",
      label: "Learn",
      icon: <BookOpen className="w-4 h-4" />,
      action: () => router.push("/learn"),
      group: "Resources",
    },
  ];

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    setSearchQuery("");
    command();
  }, []);

  const handleStockSelect = (symbol: string) => {
    setOpen(false);
    setSearchQuery("");
    router.push(`/charts?symbol=${symbol}`);
  };

  // Filter navigation commands based on search
  const filteredCommands = searchQuery
    ? navigationCommands.filter((cmd) =>
        cmd.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : navigationCommands;

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setSearchQuery("");
          setStocks([]);
          setLoading(false);
        }
      }}
      className="rounded-xl overflow-hidden"
    >
      {/* Search Input */}
      <div className="flex items-center border-b border-gray-200 dark:border-gray-700 px-4 bg-white dark:bg-gray-800">
        <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-3 shrink-0" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search stocks, pages, or type a command..."
          className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100"
        />
        <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-1.5 font-mono text-[10px] font-medium text-gray-400 dark:text-gray-500">
          esc
        </kbd>
      </div>

      {/* Results */}
      <div className="max-h-[400px] overflow-y-auto bg-white dark:bg-gray-800">
        {/* Stock Results */}
        {stocks.length > 0 && (
          <div className="p-2">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              Stocks
            </div>
            {stocks.map((stock) => (
              <button
                key={stock.symbol}
                onClick={() => handleStockSelect(stock.symbol)}
                className="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm outline-none w-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <CandlestickChart className="w-4 h-4 mr-3 text-blue-500" />
                <span className="font-medium">{stock.symbol}</span>
                <span className="ml-2 text-gray-400 dark:text-gray-500">
                  {stock.name || "View chart"}
                </span>
                <kbd className="ml-auto text-xs tracking-widest text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                  Enter
                </kbd>
              </button>
            ))}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
            <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
          </div>
        )}

        {/* Navigation Commands */}
        <div className="p-2">
          {["Navigation", "Portfolio", "Resources"].map((group) => {
            const groupItems = filteredCommands.filter((cmd) => cmd.group === group);
            if (groupItems.length === 0) return null;

            return (
              <div key={group}>
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {group}
                </div>
                {groupItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => runCommand(item.action)}
                    className="relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2.5 text-sm outline-none w-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <span className="mr-3 text-gray-500 dark:text-gray-400">{item.icon}</span>
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <span className="ml-auto text-xs tracking-widest text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono">
                        {item.shortcut}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
        <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono text-gray-600 dark:text-gray-300">Up/Down</kbd>
        <span className="mx-2">navigate</span>
        <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono text-gray-600 dark:text-gray-300">Enter</kbd>
        <span className="mx-2">select</span>
        <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono text-gray-600 dark:text-gray-300">esc</kbd>
        <span className="mx-2">close</span>
      </div>
    </CommandDialog>
  );
}
