"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Skeleton,
  ErrorState,
  DataTable,
  TickerMenu,
  PageTransition,
} from "@/components/ui";
import { showSuccess, showError } from "@/components/ui/toast";
import { BarChart } from "@/components/charts";
import { TrendingUp, TrendingDown, BarChart3, ArrowRight, Activity, Zap, Shield, Search, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface FactorExposure {
  symbol: string;
  momentum: number;
  value: number;
  volatility: number;
  size: number;
}

type FactorKey = keyof Omit<FactorExposure, "symbol">;

const FACTORS: { value: FactorKey; label: string; description: string }[] = [
  { value: "momentum", label: "Momentum", description: "12-1 month price momentum" },
  { value: "value", label: "Value", description: "Price relative to moving average proxy" },
  { value: "volatility", label: "Low Volatility", description: "Inverse volatility (low vol anomaly)" },
  { value: "size", label: "Size", description: "Volume-based size proxy" },
];

export default function FactorsPage() {
  const [selectedFactor, setSelectedFactor] = useState<FactorKey>("momentum");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topStocks, setTopStocks] = useState<FactorExposure[]>([]);
  const [bottomStocks, setBottomStocks] = useState<FactorExposure[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function fetchFactorData() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/factors?factor=${selectedFactor}&limit=50`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (isMounted) {
          if (data.error) {
            setError(data.error);
            showError("Data error", data.error);
          } else {
            setTopStocks(data.topStocks || []);
            setBottomStocks(data.bottomStocks || []);
            showSuccess("Factor data loaded", `Analyzed ${(data.topStocks || []).length} stocks by ${selectedFactor}`);
          }
        }
      } catch (err) {
        console.error("Failed to fetch factor data:", err);
        if (isMounted) {
          const errorMessage = "Failed to load factor data. Please try again.";
          setError(errorMessage);
          showError("Loading failed", errorMessage);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchFactorData();

    return () => {
      isMounted = false;
    };
  }, [selectedFactor]);

  const currentFactor = FACTORS.find((f) => f.value === selectedFactor);
  const getFactorValue = (stock: FactorExposure): number => stock[selectedFactor];

  return (
    <PageTransition variant="slideUp">
      <div className="max-w-full space-y-8">
        {/* Header */}
        <header className="mb-12 pb-8 border-b border-stone-200 dark:border-neutral-800">
          {/* Kicker with emerald accent */}
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-px bg-emerald-700 dark:bg-emerald-500" />
            <span className="text-xs font-sans uppercase tracking-[0.15em] text-stone-500 dark:text-neutral-500">
              Quantitative Analysis
            </span>
          </div>

          {/* Headline - Serif, dramatic */}
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-stone-900 dark:text-white leading-tight">
            Factor Analytics
          </h1>

          {/* Subheadline */}
          <p className="font-sans text-base text-stone-600 dark:text-neutral-400 max-w-2xl leading-relaxed mt-4">
            Quantitative analysis of market drivers and equity anomalies
          </p>

          <div className="mt-6 flex justify-end">
            <Badge variant="outline" className="bg-emerald-50/50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold px-3 py-1">
              HOSE Coverage: 500+ Symbols
            </Badge>
          </div>
        </header>

        {/* Factor Selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FACTORS.map((factor) => {
            const isSelected = selectedFactor === factor.value;
            return (
              <Card
                key={factor.value}
                className={cn(
                  "cursor-pointer transition-all duration-300 border-stone-100 dark:border-neutral-800 group",
                  isSelected
                    ? "ring-2 ring-emerald-500 bg-emerald-50 dark:bg-emerald-900/25 translate-y-[-2px]"
                    : "hover:bg-stone-100 dark:hover:bg-neutral-800/50"
                )}
                onClick={() => setSelectedFactor(factor.value)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className={cn(
                      "w-10 h-10 flex items-center justify-center transition-colors",
                      isSelected ? "bg-emerald-700 text-white" : "bg-stone-100 dark:bg-neutral-800 text-stone-500 group-hover:bg-stone-200 dark:group-hover:bg-neutral-700"
                    )}>
                      {factor.value === 'momentum' && <Zap className="w-5 h-5" />}
                      {factor.value === 'value' && <BarChart3 className="w-5 h-5" />}
                      {factor.value === 'volatility' && <Shield className="w-5 h-5" />}
                      {factor.value === 'size' && <Activity className="w-5 h-5" />}
                    </div>
                    {isSelected && (
                      <div className="w-2 h-2 bg-emerald-500 animate-pulse" />
                    )}
                  </div>
                  <h3 className={cn("font-bold text-sm mb-1", isSelected ? "text-emerald-700 dark:text-emerald-400" : "text-stone-900 dark:text-white")}>
                    {factor.label}
                  </h3>
                  <p className="text-[10px] text-stone-500 dark:text-neutral-500 leading-relaxed uppercase font-bold tracking-tight">
                    {factor.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Error State */}
        {error && !loading && (
          <ErrorState message="Failed to load factor data" description={error} />
        )}

        <div className="space-y-6">
          <Tabs defaultValue="rankings" className="w-full">
            <div className="flex items-center justify-between mb-4 bg-stone-100/50 dark:bg-neutral-900/50 p-1.5 border border-stone-100 dark:border-neutral-800">
              <TabsList className="bg-transparent border-none">
                <TabsTrigger value="rankings" className="data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 text-xs font-bold px-6">
                  Equity Rankings
                </TabsTrigger>
                <TabsTrigger value="distribution" className="data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 text-xs font-bold px-6">
                  Distribution Analysis
                </TabsTrigger>
                <TabsTrigger value="theory" className="data-[state=active]:bg-white dark:data-[state=active]:bg-neutral-800 text-xs font-bold px-6">
                  Methodology
                </TabsTrigger>
              </TabsList>
              <div className="hidden md:flex items-center gap-2 pr-2">
                <Search className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Factor: {currentFactor?.label}</span>
              </div>
            </div>

            <TabsContent value="rankings" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Exposure Table */}
                <Card className="overflow-hidden border-stone-100 dark:border-neutral-800">
                  <CardHeader className="pb-4 bg-stone-100/30 dark:bg-neutral-900/30 border-b border-stone-100 dark:border-neutral-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center">
                          <TrendingUp className="w-3.5 h-3.5 mr-2 text-emerald-500" />
                          High {currentFactor?.label} Exposure
                        </CardTitle>
                      </div>
                      <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-100">Top 50</Badge>
                    </div>
                  </CardHeader>
                  <DataTable
                    data={topStocks}
                    isLoading={loading}
                    columns={[
                      {
                        header: "Rank",
                        accessorKey: "rank",
                        cell: (s) => (
                          <span className="text-[10px] font-bold text-stone-400">
                            #{Math.max(1, topStocks.findIndex((item) => item.symbol === s.symbol) + 1)}
                          </span>
                        ),
                        width: "15%",
                      },
                      {
                        header: "Symbol",
                        accessorKey: "symbol",
                        sortable: true,
                        cell: (s) => (
                          <TickerMenu symbol={s.symbol}>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer">{s.symbol}</span>
                          </TickerMenu>
                        ),
                        width: "35%",
                      },
                      {
                        header: "Factor Score",
                        accessorKey: selectedFactor,
                        sortable: true,
                        align: "right",
                        cell: (s) => (
                          <Badge variant="success" className="font-mono text-[10px]">
                            {getFactorValue(s).toFixed(2)}
                          </Badge>
                        ),
                        width: "30%",
                      },
                      {
                        header: "",
                        accessorKey: "link",
                        align: "center",
                        cell: (s) => (
                          <Link href={`/charts?symbol=${s.symbol}`} className="text-stone-400 hover:text-emerald-600">
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        ),
                        width: "20%",
                      },
                    ]}
                    height="450px"
                  />
                </Card>

                {/* Bottom Exposure Table */}
                <Card className="overflow-hidden border-stone-100 dark:border-neutral-800">
                  <CardHeader className="pb-4 bg-stone-100/30 dark:bg-neutral-900/30 border-b border-stone-100 dark:border-neutral-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center">
                          <TrendingDown className="w-3.5 h-3.5 mr-2 text-rose-500" />
                          Low {currentFactor?.label} Exposure
                        </CardTitle>
                      </div>
                      <Badge variant="outline" className="text-[9px] bg-rose-50 text-rose-700 border-rose-100">Bottom 50</Badge>
                    </div>
                  </CardHeader>
                  <DataTable
                    data={bottomStocks}
                    isLoading={loading}
                    columns={[
                      {
                        header: "Rank",
                        accessorKey: "rank",
                        cell: (s) => (
                          <span className="text-[10px] font-bold text-stone-400">
                            #
                            {Math.max(
                              1,
                              bottomStocks.length - Math.max(0, bottomStocks.findIndex((item) => item.symbol === s.symbol))
                            )}
                          </span>
                        ),
                        width: "15%",
                      },
                      {
                        header: "Symbol",
                        accessorKey: "symbol",
                        sortable: true,
                        cell: (s) => (
                          <TickerMenu symbol={s.symbol}>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer">{s.symbol}</span>
                          </TickerMenu>
                        ),
                        width: "35%",
                      },
                      {
                        header: "Factor Score",
                        accessorKey: selectedFactor,
                        sortable: true,
                        align: "right",
                        cell: (s) => (
                          <Badge variant="destructive" className="font-mono text-[10px]">
                            {getFactorValue(s).toFixed(2)}
                          </Badge>
                        ),
                        width: "30%",
                      },
                      {
                        header: "",
                        accessorKey: "link",
                        align: "center",
                        cell: (s) => (
                          <Link href={`/charts?symbol=${s.symbol}`} className="text-stone-400 hover:text-emerald-600">
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        ),
                        width: "20%",
                      },
                    ]}
                    height="450px"
                  />
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="distribution" className="mt-0">
              <Card className="border-stone-100 dark:border-neutral-800">
                <CardHeader>
                  <CardTitle className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center">
                    <Activity className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                    Market Distribution Analysis
                  </CardTitle>
                  <CardDescription className="text-[10px]">Comparison of {currentFactor?.label} scores across top constituents</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-[350px] w-full" />
                  ) : (
                    <BarChart data={topStocks.slice(0, 15).map((s) => ({ name: s.symbol, value: getFactorValue(s) }))} height={350} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="theory" className="mt-0">
              {/* Theory content placeholder */}
              <Card className="border-stone-100 dark:border-neutral-800">
                <CardHeader>
                  <CardTitle className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center">
                    <BookOpen className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                    Factor Theory & Methodology
                  </CardTitle>
                  <CardDescription className="text-[10px]">Understanding {currentFactor?.label} factor analysis</CardDescription>
                </CardHeader>
                <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-stone-600 dark:text-neutral-400">
                    Factor analysis is a quantitative method used to explain the returns of securities based on their exposure to various risk factors.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageTransition>
  );
}
