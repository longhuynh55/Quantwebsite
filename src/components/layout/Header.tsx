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
import { dispatchCommandPaletteOpenEvent } from "@/lib/commandPaletteEvents";

const mobileNavItems = [
  { href: "/dashboard", label: "Dashboard" },
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
      case "/": return "Landing";
      case "/dashboard": return "Market Overview";
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
      <header className="relative h-16 flex items-center justify-between px-6 border-b border-stone-200 dark:border-neutral-800 bg-stone-50/90 dark:bg-neutral-950/90 backdrop-blur-md sticky top-0 z-30 transition-all duration-300">
        <div className="absolute inset-x-0 top-0 h-px bg-emerald-700/70 dark:bg-emerald-500/70" />
        <div className="flex items-center space-x-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-stone-500 dark:text-neutral-400"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="header-mobile-menu"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>

          <div className="hidden lg:flex flex-col">
            <h2 className="font-serif text-base font-semibold text-stone-900 dark:text-white tracking-tight leading-none mb-1 capitalize">
              {getPageTitle(pathname)}
            </h2>
            <span className="text-[10px] text-stone-500 dark:text-neutral-500 font-semibold tracking-[0.14em] flex items-center gap-2 uppercase">
              QuantVN Analytics Engine <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" /> Live
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            className="hidden md:flex items-center space-x-3 w-64 bg-stone-100/60 dark:bg-neutral-900/60 border-stone-200 dark:border-neutral-700/60 text-stone-400 dark:text-neutral-500 hover:bg-stone-50 dark:hover:bg-neutral-900 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-300 rounded-xl px-3 group"
            onClick={dispatchCommandPaletteOpenEvent}
          >
            <Search className="w-4 h-4 group-hover:text-emerald-600 transition-colors" />
            <span className="text-xs font-medium flex-1 text-left">Find stocks or tools...</span>
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-stone-200 dark:border-neutral-600 bg-stone-50 dark:bg-neutral-800 px-1.5 font-mono text-[10px] font-medium text-stone-400 dark:text-neutral-500 opacity-100">
              Ctrl+K
            </kbd>
          </Button>

          <div className="flex items-center border-l border-stone-200 dark:border-neutral-800 pl-3 space-x-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-stone-500 dark:text-neutral-400 hover:bg-stone-100 dark:hover:bg-neutral-800/50 rounded-xl"
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
              className="text-stone-500 dark:text-neutral-400 hover:bg-stone-100 dark:hover:bg-neutral-800/50 rounded-xl"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="w-5 h-5 text-amber-400 animate-in spin-in-90 duration-500" />
              ) : (
                <Moon className="w-5 h-5 text-emerald-700 animate-in spin-in-90 duration-500" />
              )}
            </Button>

            <AiAssistantTrigger />
          </div>

          <Button size="sm" className="hidden sm:flex bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 rounded-xl font-medium px-4">
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
            className="fixed top-16 left-0 right-0 z-30 lg:hidden border-b border-stone-200 dark:border-neutral-800 bg-stone-50/95 dark:bg-neutral-950/95 backdrop-blur-md"
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
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "text-stone-700 dark:text-neutral-300 hover:bg-stone-100 dark:hover:bg-neutral-800"
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
