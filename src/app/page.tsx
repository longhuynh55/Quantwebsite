"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Skeleton,
  SkeletonStats,
  PageTransition,
  TickerMenu,
} from "@/components/ui";
import { showError } from "@/components/ui/toast";
import { LineChart } from "@/components/charts";
import {
  TrendingUp,
  Search,
  LineChart as LineChartIcon,
  PieChart,
  Shield,
  Brain,
  Activity,
  Database,
  Zap,
  Globe,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";

interface MarketOverview {
  totalStocks: number;
  avgVolume: number;
  benchmark?: string;
  topGainers: { symbol: string; change: number }[];
  topLosers: { symbol: string; change: number }[];
  marketTrend: { date: string; value: number }[];
  mtdReturn: number;
  currentIndex: number;
}

export default function HomePage() {
  const [marketData, setMarketData] = useState<MarketOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchMarketData() {
      try {
        const response = await fetch("/api/market-overview");

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        if (!isMounted) return;

        if (isMounted) {
          setMarketData({
            totalStocks: data.totalStocks,
            avgVolume: data.avgVolume,
            benchmark: data.benchmark,
            topGainers: data.topGainers,
            topLosers: data.topLosers,
            marketTrend: data.marketTrend,
            mtdReturn: data.mtdReturn,
            currentIndex: data.currentIndex,
          });
        }
      } catch (err) {
        console.error("Failed to fetch market data:", err);
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : "Failed to load market data";
          showError("Loading failed", errorMessage);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchMarketData();

    return () => {
      isMounted = false;
    };
  }, []);

  const features = [
    {
      icon: Search,
      title: "Stock Screener",
      description:
        "Filter stocks by technical indicators, performance metrics, and custom criteria.",
      href: "/screener",
      color: "from-blue-500 to-blue-600",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-600",
    },
    {
      icon: LineChartIcon,
      title: "Strategy Backtesting",
      description:
        "Test trading strategies on historical data with comprehensive performance metrics.",
      href: "/backtesting",
      color: "from-green-500 to-emerald-600",
      iconBg: "bg-green-500/10",
      iconColor: "text-green-600",
    },
    {
      icon: PieChart,
      title: "Portfolio Optimization",
      description:
        "Build optimized portfolios using Mean-Variance, Risk Parity, and more.",
      href: "/portfolio",
      color: "from-purple-500 to-violet-600",
      iconBg: "bg-purple-500/10",
      iconColor: "text-purple-600",
    },
    {
      icon: TrendingUp,
      title: "Factor Investing",
      description:
        "Analyze stocks through momentum, value, volatility, and size factors.",
      href: "/factors",
      color: "from-orange-500 to-amber-600",
      iconBg: "bg-orange-500/10",
      iconColor: "text-orange-600",
    },
    {
      icon: Shield,
      title: "Risk Management",
      description:
        "Calculate VaR, drawdowns, and other risk metrics for your investments.",
      href: "/risk",
      color: "from-red-500 to-rose-600",
      iconBg: "bg-red-500/10",
      iconColor: "text-red-600",
    },
    {
      icon: Brain,
      title: "ML Lab",
      description:
        "Experiment with machine learning models for price prediction.",
      href: "/ml-lab",
      color: "from-indigo-500 to-blue-600",
      iconBg: "bg-indigo-500/10",
      iconColor: "text-indigo-600",
    },
  ];

  return (
    <PageTransition variant="slideUp">
      <div className="max-w-full space-y-8">
        {/* Market Command Center Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Globe className="w-6 h-6 text-white animate-spin-slow" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Market Intelligence</h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-slate-400 max-w-xl">
              Real-time quantitative analytics for the <span className="text-blue-600 dark:text-blue-400 font-bold">HOSE Exchange</span>. 
              Institutional-grade tools for retail traders and researchers.
            </p>
            <div className="pt-1">
              <Link href="/screener">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 h-9">
                  Launch Screener
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
          
          <div className="flex items-center gap-4 bg-gray-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm">
            <div className="flex flex-col items-end pr-4 border-r border-gray-200 dark:border-slate-800">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Market Status</span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs font-bold text-gray-900 dark:text-slate-200 uppercase">Live Operations</span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">System Time</span>
              <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                {new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })} UTC
              </span>
            </div>
          </div>
        </div>

        {/* Market Snapshot Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            <SkeletonStats count={4} />
          ) : (
            <>
              <Card className="bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-900/10 dark:to-slate-900 border-blue-100 dark:border-blue-900/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Universe Size</span>
                    <Database className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{marketData?.totalStocks}</span>
                    <span className="text-xs text-gray-500 font-medium">Equities</span>
                  </div>
                  <div className="mt-2 h-1 w-full bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 w-full animate-pulse" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-900/10 dark:to-slate-900 border-emerald-100 dark:border-emerald-900/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Avg Liquidity</span>
                    <Activity className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(marketData?.avgVolume || 0)}</span>
                  </div>
                  <p className="text-[11px] text-emerald-600 font-bold mt-1 uppercase">Rolling 30D Average</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-900/10 dark:to-slate-900 border-indigo-100 dark:border-indigo-900/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{marketData?.benchmark || 'VN-INDEX'}</span>
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{marketData?.currentIndex?.toFixed(2)}</span>
                    {marketData?.mtdReturn && (
                      <span className={cn("text-xs font-bold", marketData.mtdReturn >= 0 ? "text-emerald-500" : "text-rose-500")}>
                        {marketData.mtdReturn >= 0 ? '+' : ''}{formatPercent(marketData.mtdReturn)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-900/10 dark:to-slate-900 border-amber-100 dark:border-amber-900/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Data Integrity</span>
                    <Shield className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">99.9%</span>
                    <span className="text-xs text-gray-500 font-medium">Uptime</span>
                  </div>
                  <p className="text-[11px] text-amber-600 font-bold mt-1 uppercase">HOSE 2018 - 2025</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Intelligence Feeds */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-2xl shadow-sm border-gray-100 dark:border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    Market Performance Trend
                  </CardTitle>
                  <CardDescription className="text-xs">Comparative benchmark performance over the last 30 intervals</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[11px] h-5 bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700">Real-time</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : marketData && (
                  <LineChart
                    data={marketData.marketTrend}
                    color="#3b82f6"
                    height={300}
                    showArea
                  />
                )}
              </CardContent>
            </Card>

            {/* Quick Access Tools */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {features.slice(0, 3).map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link key={tool.href} href={tool.href}>
                    <Card className="h-full hover:shadow-md hover:border-blue-200 dark:hover:border-blue-900/50 transition-all group rounded-2xl border-gray-100 dark:border-slate-800">
                      <CardContent className="p-4">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center mb-3 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <Icon className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-xs text-gray-900 dark:text-white mb-1">{tool.title}</h3>
                        <p className="text-xs text-gray-500 line-clamp-2">{tool.description}</p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            {/* Top Movers Sidebar */}
            <Card className="rounded-2xl border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
              <CardHeader className="bg-gray-50/50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-800 pb-4">
                <CardTitle className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center">
                  <Zap className="w-3.5 h-3.5 mr-2 text-amber-500" />
                  Session Leaders
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 px-0">
                <Tabs defaultValue="gainers">
                  <div className="px-4 mb-4">
                    <TabsList className="w-full bg-gray-100 dark:bg-slate-800 rounded-xl p-1 h-9">
                      <TabsTrigger value="gainers" className="flex-1 text-xs font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">Top Gainers</TabsTrigger>
                      <TabsTrigger value="losers" className="flex-1 text-xs font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">Top Losers</TabsTrigger>
                    </TabsList>
                  </div>
                  
                  <TabsContent value="gainers" className="mt-0">
                    <div className="divide-y divide-gray-100 dark:divide-slate-800">
                      {marketData?.topGainers.slice(0, 5).map((stock) => (
                        <TickerMenu key={stock.symbol} symbol={stock.symbol} className="w-full">
                          <div className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors group">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                {stock.symbol.slice(0, 1)}
                              </div>
                              <span className="font-bold text-xs text-gray-900 dark:text-slate-200 group-hover:underline">{stock.symbol}</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">+{formatPercent(stock.change)}</span>
                              <span className="text-[11px] text-gray-400 uppercase">Yield session</span>
                            </div>
                          </div>
                        </TickerMenu>
                      ))}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="losers" className="mt-0">
                    <div className="divide-y divide-gray-100 dark:divide-slate-800">
                      {marketData?.topLosers.slice(0, 5).map((stock) => (
                        <TickerMenu key={stock.symbol} symbol={stock.symbol} className="w-full">
                          <div className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors group">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-xs font-bold text-rose-600 dark:text-rose-400 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                                {stock.symbol.slice(0, 1)}
                              </div>
                              <span className="font-bold text-xs text-gray-900 dark:text-slate-200 group-hover:underline">{stock.symbol}</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-xs font-bold text-rose-600 dark:text-rose-400">{formatPercent(stock.change)}</span>
                              <span className="text-[11px] text-gray-400 uppercase">Drawdown</span>
                            </div>
                          </div>
                        </TickerMenu>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
                <div className="p-4 border-t border-gray-100 dark:border-slate-800">
                  <Link href="/screener">
                    <Button variant="ghost" size="sm" className="w-full text-xs font-bold text-blue-600 dark:text-blue-400">
                      View All Instruments
                      <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Platform Insights */}
            <Card className="rounded-2xl border-none shadow-lg bg-blue-600 dark:bg-blue-700 text-white overflow-hidden relative">
              <div className="absolute -bottom-4 -right-4 opacity-20 transform rotate-12">
                <Sparkles className="w-24 h-24" />
              </div>
              <CardContent className="p-6 relative z-10">
                <h3 className="text-sm font-bold mb-2">QuantVN Pro</h3>
                <p className="text-xs text-blue-100/80 leading-relaxed mb-4">
                  Get full access to backtest engines, factor modeling, and our experimental ML laboratory.
                </p>
                <Button size="sm" className="w-full bg-white text-blue-600 hover:bg-blue-50 font-bold rounded-xl text-xs h-8">
                  Register Account
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}

