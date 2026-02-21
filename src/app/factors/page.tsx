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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Factor Analytics</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400">Quantitative analysis of market drivers and equity anomalies</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 font-bold px-3 py-1">
              HOSE Coverage: 500+ Symbols
            </Badge>
          </div>
        </div>

        {/* Factor Selection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FACTORS.map((factor) => {
            const isSelected = selectedFactor === factor.value;
            return (
              <Card 
                key={factor.value} 
                className={cn(
                  "cursor-pointer transition-all duration-300 border-gray-100 dark:border-slate-800 rounded-2xl group",
                  isSelected 
                    ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md translate-y-[-2px]" 
                    : "hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:shadow-sm"
                )} 
                onClick={() => setSelectedFactor(factor.value)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                      isSelected ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-500 group-hover:bg-gray-200 dark:group-hover:bg-slate-700"
                    )}>
                      {factor.value === 'momentum' && <Zap className="w-5 h-5" />}
                      {factor.value === 'value' && <BarChart3 className="w-5 h-5" />}
                      {factor.value === 'volatility' && <Shield className="w-5 h-5" />}
                      {factor.value === 'size' && <Activity className="w-5 h-5" />}
                    </div>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    )}
                  </div>
                  <h3 className={cn("font-bold text-sm mb-1", isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-slate-100")}>
                    {factor.label}
                  </h3>
                  <p className="text-[10px] text-gray-500 dark:text-slate-500 leading-relaxed uppercase font-bold tracking-tight">
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
            <div className="flex items-center justify-between mb-4 bg-gray-50/50 dark:bg-slate-900/50 p-1.5 rounded-xl border border-gray-100 dark:border-slate-800">
              <TabsList className="bg-transparent border-none">
                <TabsTrigger value="rankings" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm text-xs font-bold px-6">
                  Equity Rankings
                </TabsTrigger>
                <TabsTrigger value="distribution" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm text-xs font-bold px-6">
                  Distribution Analysis
                </TabsTrigger>
                <TabsTrigger value="theory" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm text-xs font-bold px-6">
                  Methodology
                </TabsTrigger>
              </TabsList>
              <div className="hidden md:flex items-center gap-2 pr-2">
                <Search className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Factor: {currentFactor?.label}</span>
              </div>
            </div>

            <TabsContent value="rankings" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Exposure Table */}
                <Card className="rounded-2xl overflow-hidden border-gray-100 dark:border-slate-800">
                  <CardHeader className="pb-4 bg-gray-50/30 dark:bg-slate-900/30 border-b border-gray-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center">
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
                          <span className="text-[10px] font-bold text-gray-400">
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
                            <span className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">{s.symbol}</span>
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
                          <Link href={`/charts?symbol=${s.symbol}`} className="text-gray-400 hover:text-blue-500">
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
                <Card className="rounded-2xl overflow-hidden border-gray-100 dark:border-slate-800">
                  <CardHeader className="pb-4 bg-gray-50/30 dark:bg-slate-900/30 border-b border-gray-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center">
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
                          <span className="text-[10px] font-bold text-gray-400">
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
                            <span className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">{s.symbol}</span>
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
                          <Link href={`/charts?symbol=${s.symbol}`} className="text-gray-400 hover:text-blue-500">
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
              <Card className="rounded-2xl border-gray-100 dark:border-slate-800">
                <CardHeader>
                  <CardTitle className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center">
                    <Activity className="w-3.5 h-3.5 mr-2 text-blue-500" />
                    Market Distribution Analysis
                  </CardTitle>
                  <CardDescription className="text-[10px]">Comparison of {currentFactor?.label} scores across top constituents</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-[350px] w-full rounded-xl" />
                  ) : (
                    <BarChart data={topStocks.slice(0, 15).map((s) => ({ name: s.symbol, value: getFactorValue(s) }))} height={350} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="theory" className="mt-0">
              {/* Theory content placeholder */}
              <Card className="rounded-2xl border-gray-100 dark:border-slate-800">
                <CardHeader>
                  <CardTitle className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center">
                    <BookOpen className="w-3.5 h-3.5 mr-2 text-blue-500" />
                    Factor Theory & Methodology
                  </CardTitle>
                  <CardDescription className="text-[10px]">Understanding {currentFactor?.label} factor analysis</CardDescription>
                </CardHeader>
                <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-gray-600 dark:text-gray-400">
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
