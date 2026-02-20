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
  Skeleton,
  SkeletonStats,
  ErrorState,
} from "@/components/ui";
import { showError } from "@/components/ui/toast";
import { LineChart } from "@/components/charts";
import {
  TrendingUp,
  TrendingDown,
  Search,
  LineChart as LineChartIcon,
  PieChart,
  Shield,
  Brain,
  BookOpen,
  ArrowRight,
  BarChart3,
  Activity,
  Database,
  Zap,
} from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchMarketData() {
      try {
        setError(null);
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
          setError(errorMessage);
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

  const stats = [
    { icon: Database, label: "Stocks Analyzed", value: "500+", sublabel: "HOSE Listed" },
    { icon: Activity, label: "Data Points", value: "1.5M+", sublabel: "Historical Records" },
    { icon: Zap, label: "Strategies", value: "5+", sublabel: "Backtest Ready" },
    { icon: BarChart3, label: "Years of Data", value: "5", sublabel: "2020-2025" },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40"></div>

        {/* Gradient Orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-24 lg:py-32">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-sm font-medium mb-8 backdrop-blur-sm border border-white/10">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Live Market Data | HOSE 2020-2025
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Quantitative Finance for
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
                Vietnamese Stock Market
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed">
              Analyze 500+ HOSE stocks with professional-grade quantitative tools.
              Backtest strategies, optimize portfolios, and explore factor investing.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/screener">
                <Button size="lg" className="bg-white text-slate-900 hover:bg-gray-100 shadow-xl shadow-white/20 px-8 h-12 text-base font-semibold">
                  <Search className="w-5 h-5 mr-2" />
                  Start Screening
                </Button>
              </Link>
              <Link href="/learn">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10 backdrop-blur-sm px-8 h-12 text-base font-semibold"
                >
                  <BookOpen className="w-5 h-5 mr-2" />
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 mb-4">
                    <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{stat.sublabel}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Market Overview */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Market Overview</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Real-time market statistics and trends</p>
            </div>
            <Link href="/screener">
              <Button variant="outline" className="hidden sm:flex">
                View All Stocks
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          {/* Error State */}
          {error && !loading && (
            <ErrorState
              message="Failed to load market data"
              description={error}
              className="mb-6"
            />
          )}

          {loading ? (
            <SkeletonStats count={4} className="mb-6" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800 border-blue-100 dark:border-blue-800">
                <CardContent className="p-6">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Stocks</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{marketData?.totalStocks}</p>
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">HOSE Listed</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-gray-800 border-green-100 dark:border-green-800">
                <CardContent className="p-6">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Avg Daily Volume</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {formatCurrency(marketData?.avgVolume || 0)}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400 font-medium">Across all stocks</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800 border-purple-100 dark:border-purple-800">
                <CardContent className="p-6">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Market Index</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {marketData?.currentIndex?.toFixed(2) ?? "N/A"}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {marketData?.benchmark && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">{marketData.benchmark}</span>
                    )}
                    {marketData?.mtdReturn !== undefined && marketData.mtdReturn !== null && (
                      <Badge variant={marketData.mtdReturn >= 0 ? "success" : "destructive"} className="text-xs">
                        {formatPercent(marketData.mtdReturn)} MTD
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/20 dark:to-gray-800 border-orange-100 dark:border-orange-800">
                <CardContent className="p-6">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Data Period</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">5 Years</p>
                  <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">2020 - 2025</p>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <Card className="lg:col-span-2 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-gray-900 dark:text-white">Market Trend</CardTitle>
                <CardDescription>30-day market performance</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : marketData && (
                  <LineChart
                    data={marketData.marketTrend}
                    color="#3b82f6"
                    height={250}
                  />
                )}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-gray-900 dark:text-white">Top Movers</CardTitle>
                <CardDescription>Latest trading session</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                        Top Gainers
                      </p>
                      <div className="space-y-2">
                        {marketData?.topGainers.slice(0, 3).map((stock) => (
                          <div
                            key={stock.symbol}
                            className="flex justify-between items-center py-1.5 px-3 bg-green-50 dark:bg-green-900/20 rounded-lg"
                          >
                            <Link href={`/charts?symbol=${stock.symbol}`} className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                              {stock.symbol}
                            </Link>
                            <span className="text-green-600 dark:text-green-400 flex items-center text-sm font-semibold">
                              <TrendingUp className="w-4 h-4 mr-1" />
                              {formatPercent(stock.change)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                        Top Losers
                      </p>
                      <div className="space-y-2">
                        {marketData?.topLosers.slice(0, 3).map((stock) => (
                          <div
                            key={stock.symbol}
                            className="flex justify-between items-center py-1.5 px-3 bg-red-50 dark:bg-red-900/20 rounded-lg"
                          >
                            <Link href={`/charts?symbol=${stock.symbol}`} className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                              {stock.symbol}
                            </Link>
                            <span className="text-red-600 dark:text-red-400 flex items-center text-sm font-semibold">
                              <TrendingDown className="w-4 h-4 mr-1" />
                              {formatPercent(stock.change)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Powerful Quantitative Tools
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto text-lg">
              Everything you need to analyze stocks, test strategies, and build
              portfolios - all in one professional platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Link key={feature.href} href={feature.href}>
                  <Card className="h-full hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group border-gray-100 dark:border-gray-700">
                    <CardContent className="p-6">
                      <div className={`w-14 h-14 ${feature.iconBg} rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className={`w-7 h-7 ${feature.iconColor}`} />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-4">
                        {feature.description}
                      </p>
                      <div className="flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium">
                        <span>Explore</span>
                        <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-2 transition-transform duration-300" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40"></div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Ready to dive into quantitative analysis?
          </h2>
          <p className="text-gray-400 mb-10 text-lg max-w-2xl mx-auto">
            Start with our educational content or jump straight into the tools.
            No registration required.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/learn">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-gray-100 shadow-xl px-8 h-12 text-base font-semibold">
                <BookOpen className="w-5 h-5 mr-2" />
                Start Learning
              </Button>
            </Link>
            <Link href="/screener">
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 backdrop-blur-sm px-8 h-12 text-base font-semibold">
                <Search className="w-5 h-5 mr-2" />
                Try Screener
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
