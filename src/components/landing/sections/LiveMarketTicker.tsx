"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

// Mock real-time stock data - in production, this would come from API
const mockStocks = [
  { symbol: "VN-INDEX", price: 1285.5, change: 1.2 },
  { symbol: "VIC", price: 77500, change: 2.1 },
  { symbol: "VCB", price: 98500, change: 1.5 },
  { symbol: "FPT", price: 100500, change: 3.2 },
  { symbol: "VNM", price: 68500, change: -0.8 },
  { symbol: "HPG", price: 28500, change: 2.5 },
  { symbol: "MWG", price: 42500, change: -1.2 },
  { symbol: "PNJ", price: 92000, change: 1.8 },
  { symbol: "SAB", price: 58000, change: 0.5 },
  { symbol: "BID", price: 51500, change: 1.1 },
  { symbol: "CTG", price: 38200, change: -0.3 },
  { symbol: "TCB", price: 29800, change: 2.0 },
];

export function LiveMarketTicker() {
  const [stocks, setStocks] = useState(mockStocks);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setStocks((prev) =>
        prev.map((stock) => ({
          ...stock,
          change: stock.change + (Math.random() - 0.5) * 0.2,
        }))
      );
      setCurrentTime(new Date());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number, symbol: string) => {
    if (symbol === "VN-INDEX") {
      return price.toFixed(1);
    }
    return price.toLocaleString("vi-VN") + "₫";
  };

  // Double the array for seamless infinite scroll
  const tickerItems = [...stocks, ...stocks];

  return (
    <section className="bg-stone-900 dark:bg-black border-y border-stone-800 dark:border-neutral-900 py-3 overflow-hidden">
      <div className="relative">
        {/* Left fade overlay */}
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-stone-900 dark:from-black to-transparent z-10" />

        {/* Right fade overlay */}
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-stone-900 dark:from-black to-transparent z-10" />

        {/* Time indicator */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="font-mono text-xs text-stone-400 dark:text-neutral-500">
            {currentTime.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Scrolling ticker */}
        <div className="ticker-wrapper ml-20">
          <div className="ticker-content flex gap-8 animate-ticker">
            {tickerItems.map((stock, index) => (
              <div
                key={`${stock.symbol}-${index}`}
                className="flex items-center gap-3 whitespace-nowrap"
              >
                <span className="font-mono font-semibold text-stone-300 dark:text-neutral-300">
                  {stock.symbol}
                </span>
                <span className="font-mono text-white">
                  {formatPrice(stock.price, stock.symbol)}
                </span>
                <span
                  className={`flex items-center gap-1 font-mono text-sm ${
                    stock.change >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {stock.change >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {stock.change >= 0 ? "+" : ""}
                  {stock.change.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CSS for ticker animation */}
      <style jsx>{`
        .ticker-wrapper {
          overflow: hidden;
        }
        .ticker-content {
          display: inline-flex;
        }
        @keyframes ticker {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-ticker {
          animation: ticker 30s linear infinite;
        }
        .animate-ticker:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}
