"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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
  Menu,
  X,
  ChevronDown,
  Moon,
  Sun,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Button } from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { AiAssistantTrigger } from "@/components/assistant";
import { dispatchCommandPaletteOpenEvent } from "@/lib/commandPaletteEvents";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Analytics",
    items: [
      { href: "/", label: "Home", icon: LayoutDashboard },
      { href: "/screener", label: "Screener", icon: Search },
      { href: "/charts", label: "Charts", icon: TrendingUp },
    ],
  },
  {
    label: "Portfolio",
    items: [
      { href: "/backtesting", label: "Backtesting", icon: LineChart },
      { href: "/portfolio", label: "Optimization", icon: PieChart },
      { href: "/factors", label: "Factors", icon: BarChart3 },
      { href: "/risk", label: "Risk", icon: Shield },
      { href: "/ml-lab", label: "ML Lab", icon: Brain },
    ],
  },
];

const resourceItems: NavItem[] = [
  { href: "/learn", label: "Learn", icon: BookOpen },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const firstFocusableRef = useRef<HTMLAnchorElement>(null);

  // Close menu on Escape key
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === "Escape" && mobileMenuOpen) {
      setMobileMenuOpen(false);
      // Return focus to menu button
      mobileMenuButtonRef.current?.focus();
    }
  }, [mobileMenuOpen]);

  // Handle focus trap in mobile menu
  useEffect(() => {
    if (!mobileMenuOpen) return;

    // Add escape key listener
    document.addEventListener("keydown", handleKeyDown);

    // Focus first menu item when menu opens
    firstFocusableRef.current?.focus();

    // Trap focus within mobile menu
    const menuElement = mobileMenuRef.current;
    if (!menuElement) return;

    const focusableElements = menuElement.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        // Shift + Tab: if on first element, go to last
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab: if on last element, go to first
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    menuElement.addEventListener("keydown", handleTabKey);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      menuElement.removeEventListener("keydown", handleTabKey);
    };
  }, [mobileMenuOpen, handleKeyDown]);

  // Restore focus when menu closes
  useEffect(() => {
    if (!mobileMenuOpen) {
      // Small delay to ensure DOM is updated
      const timer = setTimeout(() => {
        mobileMenuButtonRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mobileMenuOpen]);

  const isActiveInGroup = (items: NavItem[]) =>
    items.some((item) => pathname === item.href);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <nav className="bg-stone-50/95 dark:bg-neutral-950/95 supports-[backdrop-filter]:bg-stone-50/85 supports-[backdrop-filter]:dark:bg-neutral-950/85 supports-[backdrop-filter]:backdrop-blur-sm border-b border-stone-200 dark:border-neutral-800 sticky top-0 z-50 shadow-sm transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-700 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/25 group-hover:shadow-emerald-900/40 transition-shadow">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-neutral-900"></div>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xl text-stone-900 dark:text-white tracking-tight">QuantVN</span>
                <span className="text-[10px] text-stone-500 dark:text-neutral-400 font-medium -mt-1 hidden sm:block">Quantitative Finance</span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation with Dropdowns */}
          <div className="hidden lg:flex items-center space-x-1">
            {navGroups.map((group) => (
              <DropdownMenu key={group.label}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200",
                      isActiveInGroup(group.items)
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                        : "text-stone-600 dark:text-neutral-300 hover:bg-stone-100 dark:hover:bg-neutral-800 hover:text-stone-900 dark:hover:text-white"
                    )}
                  >
                    <span>{group.label}</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DropdownMenuItem key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center space-x-2 w-full",
                            pathname === item.href
                              ? "text-emerald-700 dark:text-emerald-300"
                              : ""
                          )}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            ))}

            {/* Resources Link */}
            <Link
              href="/learn"
              className={cn(
                "flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200",
                pathname === "/learn"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                  : "text-stone-600 dark:text-neutral-300 hover:bg-stone-100 dark:hover:bg-neutral-800 hover:text-stone-900 dark:hover:text-white"
              )}
            >
              <BookOpen className="w-4 h-4" />
              <span>Resources</span>
            </Link>
          </div>

          {/* Right Side Actions */}
          <div className="hidden lg:flex items-center space-x-2">
            {/* Search Button */}
            <Button
              variant="ghost"
              size="sm"
              className="text-stone-600 dark:text-neutral-300 hover:bg-stone-100 dark:hover:bg-neutral-800"
              onClick={dispatchCommandPaletteOpenEvent}
            >
              <Search className="w-4 h-4" />
              <span className="ml-2 text-xs text-stone-400 dark:text-neutral-500 hidden xl:inline">
                Ctrl+K
              </span>
            </Button>

            {/* Dark Mode Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="text-stone-600 dark:text-neutral-300 hover:bg-stone-100 dark:hover:bg-neutral-800"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>

            {/* AI Assistant Trigger */}
            <AiAssistantTrigger />

            <Link href="/screener">
              <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800 shadow-md shadow-emerald-900/25">
                Get Started
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-stone-600 dark:text-neutral-300"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>
            <Button
              ref={mobileMenuButtonRef}
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-stone-600 dark:text-neutral-300"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className="lg:hidden border-t border-stone-200 dark:border-neutral-800 bg-stone-50/95 dark:bg-neutral-950/95 supports-[backdrop-filter]:bg-stone-50/85 supports-[backdrop-filter]:dark:bg-neutral-950/85 supports-[backdrop-filter]:backdrop-blur-sm"
        >
          <div className="px-3 py-4">
            {navGroups.map((group, groupIndex) => (
              <div key={group.label} className="mb-4">
                <h3 className="px-4 text-xs font-semibold text-stone-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                  {group.label}
                </h3>
                {group.items.map((item, itemIndex) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  // First item in first group gets the ref for focus management
                  const isFirstItem = groupIndex === 0 && itemIndex === 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      ref={isFirstItem ? firstFocusableRef : null}
                      className={cn(
                        "flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-medium transition-colors duration-200",
                        isActive
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                          : "text-stone-600 dark:text-neutral-300 hover:bg-stone-100 dark:hover:bg-neutral-800"
                      )}
                      onClick={closeMobileMenu}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}

            {/* Resources */}
            <div className="mb-4">
              <h3 className="px-4 text-xs font-semibold text-stone-500 dark:text-neutral-400 uppercase tracking-wider mb-2">
                Resources
              </h3>
              {resourceItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-medium transition-colors duration-200",
                      isActive
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                        : "text-stone-600 dark:text-neutral-300 hover:bg-stone-100 dark:hover:bg-neutral-800"
                    )}
                    onClick={closeMobileMenu}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="pt-4 px-2 space-y-2 border-t border-stone-200 dark:border-neutral-800">
              <Link href="/screener" onClick={closeMobileMenu}>
                <Button className="w-full bg-emerald-700 hover:bg-emerald-800">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

