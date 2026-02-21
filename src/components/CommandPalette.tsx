"use client";

import * as React from "react";
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
  HelpCircle,
  Settings,
  ArrowRight,
} from "lucide-react";

import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command";

interface StockResult {
  symbol: string;
  name?: string;
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [stocks, setStocks] = React.useState<StockResult[]>([]);
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
      return;
    }

    const controller = new AbortController();
    let active = true;
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
      }
    };

    const timeout = setTimeout(fetchStocks, 200);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [searchQuery]);

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

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o: boolean) => {
        setOpen(o);
        if (!o) {
          setSearchQuery("");
          setStocks([]);
        }
      }}
    >
      <CommandInput
        placeholder="Type a command or search for stocks..."
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList className="max-h-[450px] scrollbar-thin">
        <CommandEmpty>No results found.</CommandEmpty>
        
        {/* Recent / Suggested Group */}
        {searchQuery.length === 0 && (
          <CommandGroup heading="Suggestions">
            <CommandItem onSelect={() => runCommand(() => router.push("/screener"))}>
              <Search className="mr-2 h-4 w-4 text-blue-500" />
              <span>Explore Stock Screener</span>
              <CommandShortcut>G S</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/charts"))}>
              <TrendingUp className="mr-2 h-4 w-4 text-green-500" />
              <span>Technical Charts</span>
              <CommandShortcut>G C</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/backtesting"))}>
              <LineChart className="mr-2 h-4 w-4 text-purple-500" />
              <span>Run Backtest Strategy</span>
              <CommandShortcut>G B</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        )}

        {/* Dynamic Stock Results */}
        {stocks.length > 0 && (
          <CommandGroup heading="Market Symbols">
            {stocks.map((stock) => (
              <CommandItem
                key={stock.symbol}
                onSelect={() => handleStockSelect(stock.symbol)}
                className="flex items-center"
              >
                <CandlestickChart className="mr-2 h-4 w-4 text-blue-400" />
                <div className="flex flex-col">
                  <span className="font-bold">{stock.symbol}</span>
                  {stock.name && <span className="text-[10px] text-gray-400">{stock.name}</span>}
                </div>
                <div className="ml-auto flex items-center text-[10px] text-gray-400 font-mono">
                  View Chart <ArrowRight className="ml-1 h-3 w-3" />
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* Navigation Group */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push("/"))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/portfolio"))}>
            <PieChart className="mr-2 h-4 w-4" />
            <span>Portfolio Optimization</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/factors"))}>
            <BarChart3 className="mr-2 h-4 w-4" />
            <span>Factor Analysis</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/risk"))}>
            <Shield className="mr-2 h-4 w-4" />
            <span>Risk Management</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/ml-lab"))}>
            <Brain className="mr-2 h-4 w-4" />
            <span>ML Lab</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* System & Support */}
        <CommandGroup heading="System">
          <CommandItem onSelect={() => runCommand(() => router.push("/learn"))}>
            <BookOpen className="mr-2 h-4 w-4" />
            <span>Learning Hub</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => {})}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
            <CommandShortcut>⌘S</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => {})}>
            <HelpCircle className="mr-2 h-4 w-4" />
            <span>Get Support</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
      
      {/* Footer Info */}
      <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 px-4 py-3 text-[10px] text-gray-500 dark:text-slate-400 font-medium">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1 py-0.5">↑↓</kbd>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1 py-0.5">↵</kbd>
            <span>Select</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-blue-500" />
          <span>QuantVN Command Engine v1.0</span>
        </div>
      </div>
    </CommandDialog>
  );
}
