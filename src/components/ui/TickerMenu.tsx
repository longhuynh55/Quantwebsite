"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuLabel,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
 TrendingUp,
 LineChart,
 Shield,
 BarChart3,
 ExternalLink,
 Copy,
 Plus,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TickerMenuProps {
 symbol: string;
 children: React.ReactNode;
 className?: string;
}

export function TickerMenu({ symbol, children, className }: TickerMenuProps) {
 const router = useRouter();

 const actions = [
 {
 label: "View Charts",
 icon: TrendingUp,
 onClick: () => router.push(`/charts?symbol=${symbol}`),
 color: "text-emerald-600 dark:text-emerald-300",
 },
 {
 label: "Run Backtest",
 icon: LineChart,
 onClick: () => router.push(`/backtesting?symbol=${symbol}`),
 color: "text-emerald-700 dark:text-emerald-400",
 },
 {
 label: "Risk Analysis",
 icon: Shield,
 onClick: () => router.push(`/risk?symbol=${symbol}`),
 color: "text-red-500",
 },
 {
 label: "Factor Profile",
 icon: BarChart3,
 onClick: () => router.push(`/factors?symbol=${symbol}`),
 color: "text-amber-500",
 },
 ];

 const copyTicker = () => {
 navigator.clipboard.writeText(symbol);
 toast.success(`Ticker ${symbol} copied to clipboard`);
 };

 return (
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <div className={cn("cursor-pointer", className)}>
 {children}
 </div>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="start" className="w-56 border-stone-200 dark:border-neutral-800">
 <DropdownMenuLabel className="flex items-center justify-between">
 <span className="font-bold text-stone-900 dark:text-white">{symbol}</span>
 <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-neutral-500">Actions</span>
 </DropdownMenuLabel>
 <DropdownMenuSeparator />
 
 {actions.map((action) => (
 <DropdownMenuItem
 key={action.label}
 onClick={action.onClick}
 className="flex items-center gap-3 py-2.5 cursor-pointer group"
 >
 <action.icon className={cn("w-4 h-4 transition-transform group-hover:scale-110", action.color)} />
 <span className="text-sm font-medium">{action.label}</span>
 </DropdownMenuItem>
 ))}

 <DropdownMenuSeparator />
 
 <DropdownMenuItem onClick={copyTicker} className="flex items-center gap-3 py-2.5 cursor-pointer">
 <Copy className="w-4 h-4 text-stone-400 dark:text-neutral-500" />
 <span className="text-sm font-medium">Copy Ticker</span>
 </DropdownMenuItem>
 
 <DropdownMenuItem className="flex items-center gap-3 py-2.5 cursor-pointer">
 <Plus className="w-4 h-4 text-stone-400 dark:text-neutral-500" />
 <span className="text-sm font-medium">Add to Watchlist</span>
 </DropdownMenuItem>
 
 <DropdownMenuSeparator />
 
 <DropdownMenuItem 
 onClick={() => window.open(`https://finance.vietstock.vn/${symbol}`, '_blank')}
 className="flex items-center gap-3 py-2.5 cursor-pointer"
 >
 <ExternalLink className="w-4 h-4 text-stone-400 dark:text-neutral-500" />
 <span className="text-sm font-medium">External: Vietstock</span>
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 );
}
