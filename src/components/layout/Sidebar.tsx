"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { statusColors } from "@/lib/design-system/colors";
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
} from "lucide-react";
import { Button } from "@/components/ui";

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
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
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
        <h3 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
          {title}
        </h3>
        <ChevronRight
          className={cn(
            "w-3 h-3 text-gray-400 dark:text-slate-500 transition-transform duration-200",
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
          text: statusColors.live.text,
          bg: statusColors.live.bg,
          statusClass: "status-live",
        };
      case "stale":
        return {
          label: "Stale",
          text: statusColors.stale.text,
          bg: statusColors.stale.bg,
          statusClass: "status-stale",
        };
      case "error":
        return {
          label: "Error",
          text: statusColors.error.text,
          bg: statusColors.error.bg,
          statusClass: "status-error",
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col border-r border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-300 z-40 sticky top-0 h-screen",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Sidebar Header */}
      <div className="h-16 flex items-center px-6 border-b border-gray-100 dark:border-slate-800/50">
        <Link href="/" className="flex items-center space-x-3 group overflow-hidden">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <span className="font-bold text-xl text-gray-900 dark:text-white tracking-tight animate-in fade-in duration-300">
              QuantVN
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
                        ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:text-gray-900 dark:hover:text-slate-200"
                    )}
                  >
                    <Icon className={cn("w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110", isActive ? "" : "opacity-70 group-hover:opacity-100")} />
                    {!collapsed && (
                      <span className="ml-3 text-sm font-medium animate-in fade-in duration-300">
                        {item.label}
                      </span>
                    )}
                    {isActive && !collapsed && (
                      <div className="absolute right-2 w-1 h-5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                    )}
                    {collapsed && (
                      <div className="sidebar-tooltip absolute left-full ml-4 px-3 py-2 bg-gray-900 dark:bg-slate-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 whitespace-nowrap shadow-lg">
                        <div className="font-semibold">{item.label}</div>
                        <div className="text-gray-300 dark:text-slate-300 text-[10px] mt-0.5">
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
              <h3 className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                Recent
              </h3>
              <History className="w-3 h-3 text-gray-400 dark:text-slate-500" />
            </div>
            <div className="space-y-1">
              {recentItems.slice(0, 4).map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 group",
                    "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:text-gray-900 dark:hover:text-slate-200"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center shrink-0",
                        item.type === "stock"
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                          : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
                      )}
                    >
                      {item.type === "stock" ? item.label.charAt(0) : item.label.charAt(0)}
                    </span>
                    <span className="text-sm truncate">{item.label}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0 ml-2">
                    {formatTimeAgo(item.timestamp)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Status Section - Above collapse button */}
      {!collapsed && (
        <div className="px-4 pb-2">
          <div className="sidebar-status bg-gray-50 dark:bg-slate-800/50 rounded-xl p-3">
            {/* API Status */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                <span className="text-xs font-medium text-gray-600 dark:text-slate-300">API Status</span>
              </div>
              <div
                className={cn(
                  "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold",
                  statusInfo.statusClass
                )}
                style={{ backgroundColor: statusInfo.bg, color: statusInfo.text, paddingLeft: "16px" }}
              >
                {statusInfo.label}
              </div>
            </div>

            {/* Data Freshness */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                <span className="text-xs font-medium text-gray-600 dark:text-slate-300">Last Updated</span>
              </div>
              <span className="text-[10px] text-gray-500 dark:text-slate-400">
                {formatTimeAgo(lastUpdated)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed Status Indicator */}
      {collapsed && (
        <div className="px-4 pb-2 flex justify-center">
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
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
            <div className="sidebar-tooltip absolute left-full ml-4 px-3 py-2 bg-gray-900 dark:bg-slate-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 whitespace-nowrap shadow-lg">
              <div className="font-semibold">API: {statusInfo.label}</div>
              <div className="text-gray-300 dark:text-slate-300 text-[10px] mt-0.5">
                Updated {formatTimeAgo(lastUpdated)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar Footer / Toggle */}
      <div className="p-4 border-t border-gray-100 dark:border-slate-800/50">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800/50 rounded-xl"
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
