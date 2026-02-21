"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Search, Sun, Moon, Bell, Menu, X } from "lucide-react";
import { Button } from "@/components/ui";
import { AiAssistantTrigger } from "@/components/assistant";
import { AlertCenter } from "@/components/alerts/AlertCenter";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { href: "/", label: "Dashboard" },
  { href: "/screener", label: "Stock Screener" },
  { href: "/charts", label: "Charts" },
  { href: "/strategy-builder", label: "Strategy Builder" },
  { href: "/backtesting", label: "Backtesting" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/factors", label: "Factor Analysis" },
  { href: "/risk", label: "Risk Management" },
  { href: "/ml-lab", label: "ML Lab" },
  { href: "/learn", label: "Knowledge Base" },
];

export function Header() {
  const pathname = usePathname();
  const { setTheme, resolvedTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [alertCenterOpen, setAlertCenterOpen] = React.useState(false);

  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [mobileMenuOpen]);

  const getPageTitle = (path: string) => {
    switch (path) {
      case "/": return "Market Overview";
      case "/screener": return "Stock Screener";
      case "/charts": return "Interactive Charts";
      case "/strategy-builder": return "Strategy Builder";
      case "/backtesting": return "Backtesting Strategy";
      case "/portfolio": return "Portfolio Optimization";
      case "/factors": return "Factor Analysis";
      case "/risk": return "Risk Management";
      case "/ml-lab": return "ML Lab";
      case "/learn": return "Learning Hub";
      default: return "Analytics Platform";
    }
  };

  return (
    <>
      <header className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 transition-all duration-300">
        <div className="flex items-center space-x-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-gray-500 dark:text-slate-400"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="header-mobile-menu"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>

          <div className="hidden lg:flex flex-col">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight leading-none mb-1 capitalize">
              {getPageTitle(pathname)}
            </h2>
            <span className="text-xs text-gray-400 dark:text-slate-500 font-medium tracking-wide flex items-center gap-2 uppercase">
              QuantVN Analytics Engine <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" /> Live
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            className="hidden md:flex items-center space-x-3 w-64 bg-gray-50/50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700/50 text-gray-400 dark:text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-300 rounded-xl px-3 group"
            onClick={() => {
              const event = new KeyboardEvent("keydown", {
                key: "k",
                metaKey: true,
                bubbles: true,
              });
              document.dispatchEvent(event);
            }}
          >
            <Search className="w-4 h-4 group-hover:text-blue-500 transition-colors" />
            <span className="text-xs font-medium flex-1 text-left">Find stocks or tools...</span>
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-1.5 font-mono text-[10px] font-medium text-gray-400 dark:text-slate-500 opacity-100">
              Ctrl+K
            </kbd>
          </Button>

          <div className="flex items-center border-l border-gray-100 dark:border-slate-800 pl-3 space-x-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800/50 rounded-xl"
              aria-label="Notifications"
              aria-expanded={alertCenterOpen}
              aria-controls="alert-center-panel"
              onClick={() => setAlertCenterOpen(true)}
            >
              <Bell className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800/50 rounded-xl"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="w-5 h-5 text-amber-400 animate-in spin-in-90 duration-500" />
              ) : (
                <Moon className="w-5 h-5 text-blue-600 animate-in spin-in-90 duration-500" />
              )}
            </Button>

            <AiAssistantTrigger />
          </div>

          <Button size="sm" className="hidden sm:flex bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 rounded-xl font-medium px-4">
            Connect Broker
          </Button>
        </div>
      </header>

      {mobileMenuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-20 bg-black/30 lg:hidden"
            aria-label="Close menu overlay"
            onClick={() => setMobileMenuOpen(false)}
          />
          <nav
            id="header-mobile-menu"
            aria-label="Mobile navigation"
            className="fixed top-16 left-0 right-0 z-30 lg:hidden border-b border-gray-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md"
          >
            <div className="max-h-[calc(100vh-4rem)] overflow-y-auto px-4 py-4 space-y-2">
              {mobileNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "block rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        </>
      )}

      <AlertCenter open={alertCenterOpen} onOpenChange={setAlertCenterOpen} />
    </>
  );
}
