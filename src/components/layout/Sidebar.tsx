"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Search,
  TrendingUp,
  LineChart,
  PieChart,
  BarChart3,
  Shield,
  Brain,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Activity,
  Clock,
  History,
  GitBranch,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui";
import { useAssistantStore } from "@/lib/stores/assistantStore";

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
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/screener", label: "Stock Screener", icon: Search },
      { href: "/charts", label: "Charts & Analysis", icon: TrendingUp },
    ],
  },
  {
    label: "Strategies",
    items: [
      { href: "/strategy-builder", label: "Strategy Builder", icon: GitBranch },
      { href: "/backtesting", label: "Backtesting", icon: LineChart },
      { href: "/portfolio", label: "Optimization", icon: PieChart },
      { href: "/factors", label: "Factor Analysis", icon: BarChart3 },
    ],
  },
  {
    label: "Advanced",
    items: [
      { href: "/risk", label: "Risk Management", icon: Shield },
      { href: "/ml-lab", label: "ML Lab", icon: Brain },
    ],
  },
  {
    label: "Resources",
    items: [
      { href: "/learn", label: "Knowledge Base", icon: BookOpen },
    ],
  },
];

// Mock recent items data
interface RecentItem {
  id: string;
  label: string;
  href: string;
  type: "stock" | "page";
  timestamp: Date;
}

const mockRecentItems: RecentItem[] = [
  { id: "1", label: "VNM", href: "/stocks/VNM", type: "stock", timestamp: new Date(Date.now() - 1000 * 60 * 5) },
  { id: "2", label: "FPT", href: "/stocks/FPT", type: "stock", timestamp: new Date(Date.now() - 1000 * 60 * 15) },
  { id: "3", label: "Backtesting", href: "/backtesting", type: "page", timestamp: new Date(Date.now() - 1000 * 60 * 30) },
  { id: "4", label: "VIC", href: "/stocks/VIC", type: "stock", timestamp: new Date(Date.now() - 1000 * 60 * 60) },
  { id: "5", label: "Screener", href: "/screener", type: "page", timestamp: new Date(Date.now() - 1000 * 60 * 90) },
];

// API Status type
type ApiStatusType = "live" | "stale" | "error";

// Collapsible section component with smooth animation
interface CollapsibleSectionProps {
  title: string;
  collapsed: boolean;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

function CollapsibleSection({ title, collapsed, children, defaultExpanded = true }: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState<number | undefined>(undefined);

  React.useEffect(() => {
    if (contentRef.current) {
      setHeight(isExpanded ? contentRef.current.scrollHeight : 0);
    }
  }, [isExpanded, collapsed]);

  // Reset to expanded when sidebar expands
  React.useEffect(() => {
    if (!collapsed) {
      setIsExpanded(defaultExpanded);
    }
  }, [collapsed, defaultExpanded]);

  if (collapsed) {
    return <>{children}</>;
  }

  return (
    <div className="px-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full px-3 py-1 mb-2 text-left group"
      >
        <h3 className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-widest">
          {title}
        </h3>
        <ChevronRight
          className={cn(
            "w-3 h-3 text-stone-400 dark:text-neutral-500 transition-transform duration-200",
            isExpanded && "rotate-90"
          )}
        />
      </button>
      <div
        style={{ height: height !== undefined ? `${height}px` : "auto" }}
        className="overflow-hidden transition-[height] duration-300 ease-in-out"
      >
        <div ref={contentRef}>{children}</div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [recentItems] = React.useState<RecentItem[]>(mockRecentItems);
  const [apiStatus, setApiStatus] = React.useState<ApiStatusType>("live");
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [isClient, setIsClient] = React.useState(false);
  const assistantUiMode = useAssistantStore((state) => state.uiMode);
  const isAssistantOpen = useAssistantStore((state) => state.isOpen);
  const openAssistantPanel = useAssistantStore((state) => state.openPanel);
  const closeAssistantPanel = useAssistantStore((state) => state.closePanel);
  const setAssistantUiMode = useAssistantStore((state) => state.setUIMode);

  // Set initial date on client only to avoid hydration mismatch
  React.useEffect(() => {
    setIsClient(true);
    setLastUpdated(new Date());
  }, []);

  // Simulate API status updates
  React.useEffect(() => {
    const interval = setInterval(() => {
      // Simulate occasional stale/error states
      const rand = Math.random();
      if (rand > 0.95) {
        setApiStatus("error");
      } else if (rand > 0.85) {
        setApiStatus("stale");
      } else {
        setApiStatus("live");
        setLastUpdated(new Date());
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Format time ago - returns placeholder during SSR to avoid hydration mismatch
  const formatTimeAgo = (date: Date | null): string => {
    if (!date || !isClient) return "...";
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Get status display info
  const getStatusInfo = () => {
    switch (apiStatus) {
      case "live":
        return {
          label: "Live",
          pillClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
          dotClass: "bg-emerald-600 dark:bg-emerald-400",
        };
      case "stale":
        return {
          label: "Stale",
          pillClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
          dotClass: "bg-amber-600 dark:bg-amber-400",
        };
      case "error":
        return {
          label: "Error",
          pillClass: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200",
          dotClass: "bg-rose-600 dark:bg-rose-400",
        };
    }
  };

  const statusInfo = getStatusInfo();
  const isCopilotActive = isAssistantOpen && assistantUiMode === "copilot";

  const handleAssistantToggle = React.useCallback(() => {
    setAssistantUiMode("copilot");
    if (isCopilotActive) {
      closeAssistantPanel();
      return;
    }
    openAssistantPanel();
  }, [closeAssistantPanel, isCopilotActive, openAssistantPanel, setAssistantUiMode]);

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col border-r border-stone-200 dark:border-neutral-800 bg-stone-50 dark:bg-neutral-950 transition-all duration-300 z-40 sticky top-0 h-screen",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Sidebar Header */}
      <div className="h-16 flex items-center px-6 border-b border-stone-200 dark:border-neutral-800/50">
        <Link href="/" className="flex items-center space-x-3 group overflow-hidden">
          <div className="w-8 h-8 bg-emerald-700 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-emerald-900/20">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <span className="font-serif text-xl font-bold text-stone-900 dark:text-white tracking-tight animate-in fade-in duration-300">
              <span className="text-emerald-700 dark:text-emerald-400">Q</span>uantVN
            </span>
          )}
        </Link>
      </div>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4 no-scrollbar">
        {navGroups.map((group) => (
          <CollapsibleSection
            key={group.label}
            title={group.label}
            collapsed={collapsed}
            defaultExpanded={true}
          >
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                      isActive
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                        : "text-stone-600 dark:text-neutral-400 hover:bg-stone-100 dark:hover:bg-neutral-800/50 hover:text-stone-900 dark:hover:text-neutral-200"
                    )}
                  >
                    <Icon className={cn("w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110", isActive ? "" : "opacity-70 group-hover:opacity-100")} />
                    {!collapsed && (
                      <span className="ml-3 text-sm font-medium animate-in fade-in duration-300">
                        {item.label}
                      </span>
                    )}
                    {isActive && !collapsed && (
                      <div className="absolute right-2 w-1 h-5 bg-emerald-700 dark:bg-emerald-400 rounded-full" />
                    )}
                    {collapsed && (
                      <div className="sidebar-tooltip absolute left-full ml-4 px-3 py-2 bg-stone-900 dark:bg-neutral-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 whitespace-nowrap shadow-lg">
                        <div className="font-semibold">{item.label}</div>
                        <div className="text-stone-300 dark:text-neutral-300 text-[10px] mt-0.5">
                          {group.label} section
                        </div>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </CollapsibleSection>
        ))}

        {/* Recent Items Section - Only show when expanded */}
        {!collapsed && (
          <div className="px-4">
            <div className="flex items-center justify-between px-3 py-1 mb-2">
              <h3 className="text-[10px] font-bold text-stone-400 dark:text-neutral-500 uppercase tracking-widest">
                Recent
              </h3>
              <History className="w-3 h-3 text-stone-400 dark:text-neutral-500" />
            </div>
            <div className="space-y-1">
              {recentItems.slice(0, 4).map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 group",
                    "text-stone-600 dark:text-neutral-400 hover:bg-stone-100 dark:hover:bg-neutral-800/50 hover:text-stone-900 dark:hover:text-neutral-200"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center shrink-0",
                        item.type === "stock"
                          ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                          : "bg-stone-200 dark:bg-neutral-700 text-stone-600 dark:text-neutral-300"
                      )}
                    >
                      {item.type === "stock" ? item.label.charAt(0) : item.label.charAt(0)}
                    </span>
                    <span className="text-sm truncate">{item.label}</span>
                  </div>
                  <span className="text-[10px] text-stone-400 dark:text-neutral-500 shrink-0 ml-2">
                    {formatTimeAgo(item.timestamp)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Assistant Shortcut */}      
      {!collapsed && (
        <div className="px-4 pb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAssistantToggle}
            className={cn(
              "w-full justify-between rounded-xl border-stone-200 bg-white text-stone-700 hover:border-emerald-300 hover:bg-emerald-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20",
              isCopilotActive && "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
            )}
            aria-label="Toggle AI Assistant"
            aria-pressed={isCopilotActive}
          >
            <span className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              <span className="text-xs font-semibold">AI Assistant</span>
            </span>
            <span className="text-[10px] font-medium text-stone-500 dark:text-neutral-400">
              {isCopilotActive ? "Open" : "Copilot"}
            </span>
          </Button>
        </div>
      )}

      {/* Status Section - Above collapse button */}
      {!collapsed && (
        <div className="px-4 pb-2">
          <div className="sidebar-status bg-stone-100/80 dark:bg-neutral-900/70 rounded-xl p-3">
            {/* API Status */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-stone-500 dark:text-neutral-400" />
                <span className="text-xs font-medium text-stone-600 dark:text-neutral-300">API Status</span>
              </div>
              <div
                className={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold",
                  statusInfo.pillClass
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", statusInfo.dotClass)} aria-hidden="true" />
                {statusInfo.label}
              </div>
            </div>

            {/* Data Freshness */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-stone-500 dark:text-neutral-400" />
                <span className="text-xs font-medium text-stone-600 dark:text-neutral-300">Last Updated</span>
              </div>
              <span className="text-[10px] text-stone-500 dark:text-neutral-400">
                {formatTimeAgo(lastUpdated)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed Status Indicator */}
      {collapsed && (
        <div className="px-4 pb-2 space-y-2">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleAssistantToggle}
              className={cn(
                "relative group w-8 h-8 rounded-lg flex items-center justify-center",
                isCopilotActive
                  ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                  : "bg-stone-100 dark:bg-neutral-800 text-stone-500 dark:text-neutral-400 hover:bg-stone-200 dark:hover:bg-neutral-700"
              )}
              aria-label="Toggle AI Assistant"
              aria-pressed={isCopilotActive}
            >
              <Bot className="w-4 h-4" />
              <div className="sidebar-tooltip absolute left-full ml-4 px-3 py-2 bg-stone-900 dark:bg-neutral-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 whitespace-nowrap shadow-lg">
                <div className="font-semibold">AI Assistant</div>
                <div className="text-stone-300 dark:text-neutral-300 text-[10px] mt-0.5">
                  {isCopilotActive ? "Copilot open" : "Open copilot"}
                </div>
              </div>
            </button>
          </div>
          <div
            className={cn(
              "relative mx-auto group w-8 h-8 rounded-lg flex items-center justify-center",
              apiStatus === "live" && "bg-green-100 dark:bg-green-900/30",
              apiStatus === "stale" && "bg-yellow-100 dark:bg-yellow-900/30",
              apiStatus === "error" && "bg-red-100 dark:bg-red-900/30"
            )}
          >
            <Activity
              className={cn(
                "w-4 h-4",
                apiStatus === "live" && "text-green-600 dark:text-green-400",
                apiStatus === "stale" && "text-yellow-600 dark:text-yellow-400",
                apiStatus === "error" && "text-red-600 dark:text-red-400"
              )}
            />
            {/* Tooltip for collapsed status */}
            <div className="sidebar-tooltip absolute left-full ml-4 px-3 py-2 bg-stone-900 dark:bg-neutral-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 whitespace-nowrap shadow-lg">
              <div className="font-semibold">API: {statusInfo.label}</div>
              <div className="text-stone-300 dark:text-neutral-300 text-[10px] mt-0.5">
                Updated {formatTimeAgo(lastUpdated)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Footer / Toggle */}
      <div className="p-4 border-t border-stone-200 dark:border-neutral-800/50">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center text-stone-500 dark:text-neutral-400 hover:bg-stone-100 dark:hover:bg-neutral-800/50 rounded-xl"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!collapsed && <span className="ml-2 text-xs font-semibold">Collapse Sidebar</span>}
        </Button>
      </div>
    </aside>
  );
}
