"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";

interface Column<T> {
 header: string;
 accessorKey: keyof T | string;
 cell?: (item: T) => React.ReactNode;
 sortable?: boolean;
 align?: "left" | "center" | "right";
 width?: string;
}

interface DataTableProps<T> {
 data: T[];
 columns: Column<T>[];
 onRowClick?: (item: T) => void;
 isLoading?: boolean;
 sortBy?: string;
 sortDir?: "asc" | "desc";
 onSort?: (key: string) => void;
 height?: string;
 rowHeight?: number;
}

function DataTableInner<T>({
 data,
 columns,
 onRowClick,
 isLoading = false,
 sortBy,
 sortDir,
 onSort,
 height = "600px",
 rowHeight = 52,
}: DataTableProps<T>) {
 const parentRef = React.useRef<HTMLDivElement>(null);

 // eslint-disable-next-line react-hooks/incompatible-library
 const rowVirtualizer = useVirtualizer({
 count: data.length,
 getScrollElement: () => parentRef.current,
 estimateSize: () => rowHeight,
 overscan: 10,
 });

 if (isLoading) {
 return (
 <div className="w-full flex flex-col gap-2">
 {Array.from({ length: 10 }).map((_, i) => (
 <div key={i} className="h-12 w-full animate-pulse bg-stone-100 dark:bg-neutral-800" />
 ))}
 </div>
 );
 }

 return (
 <div className="overflow-hidden border border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
 <div className="overflow-x-auto">
 <table className="w-full border-collapse text-sm">
 <thead className="sticky top-0 z-20 border-b border-stone-200 bg-stone-50 dark:border-neutral-700 dark:bg-neutral-800">
 <tr>
 {columns.map((column, idx) => (
 <th
 key={idx}
 className={cn(
 "px-4 py-3 text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-neutral-400 transition-colors",
 column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left",
 column.sortable && "cursor-pointer hover:text-stone-900 dark:hover:text-white"
 )}
 style={{ width: column.width }}
 onClick={() => column.sortable && onSort?.(column.accessorKey as string)}
 >
 <div className={cn("flex items-center gap-1", column.align === "right" && "justify-end", column.align === "center" && "justify-center")}>
 {column.header}
 {column.sortable && (
 <span className="text-stone-400 dark:text-neutral-500">
 {sortBy === column.accessorKey ? (
 sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
 ) : (
 <ArrowUpDown className="w-3 h-3 opacity-30" />
 )}
 </span>
 )}
 </div>
 </th>
 ))}
 </tr>
 </thead>
 </table>
 </div>

 <div
 ref={parentRef}
 className="overflow-auto relative"
 style={{ height }}
 >
 <div
 style={{
 height: `${rowVirtualizer.getTotalSize()}px`,
 width: "100%",
 position: "relative",
 }}
 >
 {rowVirtualizer.getVirtualItems().map((virtualRow) => {
 const item = data[virtualRow.index];
 return (
 <div
 key={virtualRow.key}
 data-index={virtualRow.index}
 ref={rowVirtualizer.measureElement}
 className={cn(
 "absolute top-0 left-0 w-full flex border-b border-stone-100 dark:border-neutral-800/50 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/10 transition-colors cursor-pointer group",
 onRowClick && "cursor-pointer"
 )}
 style={{
 transform: `translateY(${virtualRow.start}px)`,
 }}
 onClick={() => onRowClick?.(item)}
 >
 {columns.map((column, colIdx) => (
 <div
 key={colIdx}
 className={cn(
 "px-4 py-3 flex items-center min-w-0 overflow-hidden",
 column.align === "right" ? "justify-end text-right" : column.align === "center" ? "justify-center text-center" : "justify-start text-left"
 )}
 style={{ width: column.width || `${100 / columns.length}%` }}
 >
 {column.cell ? (
 column.cell(item)
 ) : (
 <span className="truncate font-medium text-stone-900 dark:text-neutral-200">
 {String(item?.[column.accessorKey as keyof T] ?? "")}
 </span>
 )}
 </div>
 ))}
 </div>
 );
 })}
 </div>
 </div>
 </div>
 );
}

// Export the component directly (React.memo doesn't work well with generics)
export const DataTable = DataTableInner;
