"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { Sparkline } from "./Sparkline";
import { TrendBadge } from "./TrendBadge";

/**
 * Column definition for ProDataTable
 */
export interface ProColumn<T> {
  /** Unique key for the column */
  key: string;
  /** Header label */
  header: string;
  /** Function to extract cell value from row data */
  accessor: (item: T) => React.ReactNode;
  /** Column width (CSS value) */
  width?: string;
  /** Text alignment */
  align?: "left" | "center" | "right";
  /** Additional CSS classes for the column cells */
  className?: string;
  /** Enable sparkline rendering in this column */
  sparkline?: boolean;
  /** Enable trend indicator badge */
  trendIndicator?: boolean;
  /** Color scale mode for positive/negative values */
  colorScale?: "positive-negative";
}

/**
 * Sparkline column configuration
 */
export interface SparklineColumnConfig<T> {
  /** Key matching the column to render sparkline in */
  dataKey: string;
  /** Function to extract numeric array for sparkline data */
  getValue: (item: T) => number[];
  /** Optional function to determine trend direction */
  trend?: (item: T) => "up" | "down" | "neutral";
}

/**
 * Row status type
 */
export type RowStatus = "live" | "stale" | "inactive";

/**
 * Props for ProDataTable component
 */
export interface ProDataTableProps<T> {
  /** Array of data items */
  data: T[];
  /** Column definitions */
  columns: ProColumn<T>[];
  /** Sparkline column configuration */
  sparklineColumn?: SparklineColumnConfig<T>;
  /** Function to determine row status for indicator */
  rowStatusIndicator?: (item: T) => RowStatus;
  /** Enable row selection with checkboxes */
  enableRowSelection?: boolean;
  /** Enable sticky header */
  stickyHeader?: boolean;
  /** Row click handler */
  onRowClick?: (item: T) => void;
  /** Set of selected row IDs */
  selectedRows?: Set<string>;
  /** Selection change handler */
  onSelectionChange?: (selected: Set<string>) => void;
  /** Function to get unique row ID */
  getRowId?: (item: T) => string;
  /** Additional CSS classes */
  className?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Loading state */
  loading?: boolean;
  /** Number of skeleton rows to show when loading */
  skeletonRows?: number;
  /** Enable virtualization for large datasets (default: false) */
  enableVirtualization?: boolean;
  /** Estimated row height for virtualization (default: 48) */
  estimatedRowHeight?: number;
}

/**
 * Calculate trend from numeric array
 */
function calculateTrend(values: number[]): "up" | "down" | "neutral" {
  if (!values || values.length < 2) return "neutral";

  const validValues = values.filter(
    (v): v is number => typeof v === "number" && !isNaN(v) && isFinite(v)
  );

  if (validValues.length < 2) return "neutral";

  const first = validValues[0];
  const last = validValues[validValues.length - 1];

  if (first === 0) return last > 0 ? "up" : last < 0 ? "down" : "neutral";

  const change = ((last - first) / Math.abs(first)) * 100;

  if (change > 0.5) return "up";
  if (change < -0.5) return "down";
  return "neutral";
}

/**
 * Check if a value is numeric
 */
function isNumeric(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value) && isFinite(value);
}

/**
 * Skeleton row component for loading state
 */
function SkeletonRow({ columns, enableSelection }: { columns: ProColumn<unknown>[]; enableSelection?: boolean }) {
  return (
    <tr className="animate-pulse">
      {enableSelection && (
        <td className="px-4 py-3">
          <div className="h-4 w-4 rounded bg-stone-200 dark:bg-neutral-700" />
        </td>
      )}
      {columns.map((column) => (
        <td
          key={column.key}
          className={cn(
            "px-4 py-3",
            column.align === "center" && "text-center",
            column.align === "right" && "text-right"
          )}
          style={{ width: column.width }}
        >
          <div
            className={cn(
              "h-4 rounded bg-stone-200 dark:bg-neutral-700",
              column.align === "center" && "mx-auto",
              column.align === "right" && "ml-auto"
            )}
            style={{ width: column.sparkline ? "80px" : "60%" }}
          />
        </td>
      ))}
    </tr>
  );
}

/**
 * Status indicator dot component
 */
function StatusIndicator({ status }: { status: RowStatus }) {
  return (
    <span
      className={cn(
        "inline-block w-2 h-2 rounded-full mr-2",
        status === "live" && "bg-green-500 animate-pulse",
        status === "stale" && "bg-yellow-500",
        status === "inactive" && "bg-stone-400"
      )}
      aria-label={`Status: ${status}`}
    />
  );
}

/**
 * ProDataTable - Professional data table with sparklines, trends, and status indicators
 *
 * Features:
 * - Inline sparkline charts in specified columns
 * - Row status indicators (live/stale/inactive)
 * - Color scaling for positive/negative values
 * - Row selection with checkboxes
 * - Sticky header support
 * - Loading skeleton state
 * - Empty state handling
 * - Dark mode support
 * - Responsive design
 *
 * @example
 * ```tsx
 * interface Stock {
 *   id: string;
 *   symbol: string;
 *   price: number;
 *   change: number;
 *   history: number[];
 * }
 *
 * const columns: ProColumn<Stock>[] = [
 *   { key: "symbol", header: "Symbol", accessor: (s) => s.symbol },
 *   { key: "price", header: "Price", accessor: (s) => s.price, align: "right" },
 *   { key: "change", header: "Change", accessor: (s) => s.change, colorScale: "positive-negative" },
 *   { key: "trend", header: "Trend", accessor: (s) => null, sparkline: true },
 * ];
 *
 * <ProDataTable
 *   data={stocks}
 *   columns={columns}
 *   sparklineColumn={{ dataKey: "trend", getValue: (s) => s.history }}
 *   rowStatusIndicator={(s) => s.isActive ? "live" : "inactive"}
 *   enableRowSelection
 *   getRowId={(s) => s.id}
 * />
 * ```
 */
function ProDataTableInner<T>({
  data,
  columns,
  sparklineColumn,
  rowStatusIndicator,
  enableRowSelection = false,
  stickyHeader = false,
  onRowClick,
  selectedRows = new Set(),
  onSelectionChange,
  getRowId,
  className,
  emptyMessage = "No data available",
  loading = false,
  skeletonRows = 5,
  enableVirtualization = false,
  estimatedRowHeight = 48,
}: ProDataTableProps<T>) {
  // Table container ref for virtualization
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  // Virtualizer for large datasets
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 5,
  });
  // Handle select all checkbox
  const handleSelectAll = React.useCallback(
    (checked: boolean) => {
      if (!getRowId) return;

      if (checked) {
        const allIds = new Set(data.map((item) => getRowId(item)));
        onSelectionChange?.(allIds);
      } else {
        onSelectionChange?.(new Set());
      }
    },
    [data, getRowId, onSelectionChange]
  );

  // Handle individual row selection
  const handleRowSelect = React.useCallback(
    (id: string, checked: boolean) => {
      const newSelected = new Set(selectedRows);
      if (checked) {
        newSelected.add(id);
      } else {
        newSelected.delete(id);
      }
      onSelectionChange?.(newSelected);
    },
    [selectedRows, onSelectionChange]
  );

  // Determine if all rows are selected
  const isAllSelected =
    getRowId && data.length > 0 && data.every((item) => selectedRows.has(getRowId(item)));

  // Determine if some (but not all) rows are selected
  const isSomeSelected = selectedRows.size > 0 && !isAllSelected;

  // Render cell content with color scaling
  const renderCellContent = (
    column: ProColumn<T>,
    item: T,
    value: React.ReactNode
  ) => {
    // Handle sparkline column
    if (column.sparkline && sparklineColumn?.dataKey === column.key) {
      const sparklineData = sparklineColumn.getValue(item);
      const trend = sparklineColumn.trend
        ? sparklineColumn.trend(item)
        : calculateTrend(sparklineData);

      return (
        <Sparkline
          data={sparklineData}
          width={80}
          height={24}
          trend={trend}
          showArea
          ariaLabel={`Trend chart`}
        />
      );
    }

    // Handle trend indicator
    if (column.trendIndicator && isNumeric(value)) {
      const trend: "up" | "down" | "neutral" =
        value > 0 ? "up" : value < 0 ? "down" : "neutral";
      return <TrendBadge trend={trend} value={value} size="sm" />;
    }

    // Handle color scaling for positive/negative values
    if (column.colorScale === "positive-negative" && isNumeric(value)) {
      return (
        <span
          className={cn(
            "font-medium",
            value > 0 && "text-green-600 dark:text-green-400",
            value < 0 && "text-red-600 dark:text-red-400",
            value === 0 && "text-stone-600 dark:text-neutral-400"
          )}
        >
          {value > 0 && "+"}
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
      );
    }

    return value;
  };

  // Loading state with skeleton rows
  if (loading) {
    return (
      <div className={cn("overflow-x-auto rounded-lg border border-stone-200 dark:border-neutral-700", className)}>
        <table className="table-pro w-full">
          <thead
            className={cn(
              "bg-stone-50 dark:bg-neutral-800",
              stickyHeader && "sticky top-0 z-10"
            )}
          >
            <tr>
              {enableRowSelection && (
                <th className="w-12 px-4 py-3">
                  <div className="h-4 w-4 rounded bg-stone-200 dark:bg-neutral-700" />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-neutral-400",
                    column.align === "center" && "text-center",
                    column.align === "right" && "text-right"
                  )}
                  style={{ width: column.width }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-neutral-700 bg-white dark:bg-neutral-900">
            {Array.from({ length: skeletonRows }).map((_, index) => (
              <SkeletonRow
                key={index}
                columns={columns as ProColumn<unknown>[]}
                enableSelection={enableRowSelection}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-12 px-4 rounded-lg border border-stone-200 dark:border-neutral-700 bg-white dark:bg-neutral-900",
          className
        )}
      >
        <svg
          className="w-12 h-12 text-stone-300 dark:text-neutral-600 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <p className="text-sm text-stone-500 dark:text-neutral-400">{emptyMessage}</p>
      </div>
    );
  }

  // Render a single row (used by both virtualized and non-virtualized modes)
  const renderRow = (item: T, rowIndex: number) => {
    const rowId = getRowId ? getRowId(item) : rowIndex.toString();
    const isSelected = selectedRows.has(rowId);
    const status = rowStatusIndicator ? rowStatusIndicator(item) : undefined;

    return (
      <tr
        key={rowId}
        onClick={() => onRowClick?.(item)}
        className={cn(
          "transition-colors duration-150",
          onRowClick && "cursor-pointer",
          isSelected && "bg-primary-50 dark:bg-primary-900/20",
          "hover:bg-stone-50 dark:hover:bg-neutral-800/50"
        )}
      >
        {enableRowSelection && getRowId && (
          <td
            className="px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) =>
                handleRowSelect(rowId, e.target.checked)
              }
              className="h-4 w-4 rounded border-stone-300 text-primary-600 focus:ring-primary-500 dark:border-neutral-600 dark:bg-neutral-700 dark:focus:ring-primary-500 dark:focus:ring-offset-neutral-800"
              aria-label={`Select row ${rowId}`}
            />
          </td>
        )}
        {status !== undefined && (
          <td className="px-2 py-3">
            <StatusIndicator status={status} />
          </td>
        )}
        {columns.map((column) => {
          const value = column.accessor(item);
          return (
            <td
              key={column.key}
              className={cn(
                "px-4 py-3 text-sm text-stone-900 dark:text-neutral-100",
                column.align === "center" && "text-center",
                column.align === "right" && "text-right",
                column.className
              )}
              style={{ width: column.width }}
            >
              {renderCellContent(column, item, value)}
            </td>
          );
        })}
      </tr>
    );
  };

  // Table header (shared between virtualized and non-virtualized)
  const tableHeader = (
    <thead
      className={cn(
        "bg-stone-50 dark:bg-neutral-800",
        stickyHeader && "sticky top-0 z-10"
      )}
    >
      <tr>
        {enableRowSelection && getRowId && (
          <th className="w-12 px-4 py-3">
            <input
              type="checkbox"
              checked={isAllSelected}
              ref={(el) => {
                if (el) {
                  el.indeterminate = isSomeSelected;
                }
              }}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-primary-600 focus:ring-primary-500 dark:border-neutral-600 dark:bg-neutral-700 dark:focus:ring-primary-500 dark:focus:ring-offset-neutral-800"
              aria-label="Select all rows"
            />
          </th>
        )}
        {rowStatusIndicator && (
          <th className="w-8 px-2 py-3">
            <span className="sr-only">Status</span>
          </th>
        )}
        {columns.map((column) => (
          <th
            key={column.key}
            className={cn(
              "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-neutral-400",
              column.align === "center" && "text-center",
              column.align === "right" && "text-right",
              column.className
            )}
            style={{ width: column.width }}
          >
            {column.header}
          </th>
        ))}
      </tr>
    </thead>
  );

  // Virtualized rendering for large datasets
  if (enableVirtualization) {
    return (
      <div
        ref={tableContainerRef}
        className={cn("overflow-auto rounded-lg border border-stone-200 dark:border-neutral-700 max-h-[600px]", className)}
      >
        <table className="table-pro w-full">
          {tableHeader}
          <tbody
            className="divide-y divide-stone-100 dark:divide-neutral-700 bg-white dark:bg-neutral-900 relative"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = data[virtualRow.index];
              const rowId = getRowId ? getRowId(item) : virtualRow.index.toString();
              const isSelected = selectedRows.has(rowId);
              const status = rowStatusIndicator ? rowStatusIndicator(item) : undefined;

              return (
                <tr
                  key={rowId}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  onClick={() => onRowClick?.(item)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={cn(
                    "transition-colors duration-150",
                    onRowClick && "cursor-pointer",
                    isSelected && "bg-primary-50 dark:bg-primary-900/20",
                    "hover:bg-stone-50 dark:hover:bg-neutral-800/50"
                  )}
                >
                  {enableRowSelection && getRowId && (
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) =>
                          handleRowSelect(rowId, e.target.checked)
                        }
                        className="h-4 w-4 rounded border-stone-300 text-primary-600 focus:ring-primary-500 dark:border-neutral-600 dark:bg-neutral-700 dark:focus:ring-primary-500 dark:focus:ring-offset-neutral-800"
                        aria-label={`Select row ${rowId}`}
                      />
                    </td>
                  )}
                  {status !== undefined && (
                    <td className="px-2 py-3">
                      <StatusIndicator status={status} />
                    </td>
                  )}
                  {columns.map((column) => {
                    const value = column.accessor(item);
                    return (
                      <td
                        key={column.key}
                        className={cn(
                          "px-4 py-3 text-sm text-stone-900 dark:text-neutral-100",
                          column.align === "center" && "text-center",
                          column.align === "right" && "text-right",
                          column.className
                        )}
                        style={{ width: column.width }}
                      >
                        {renderCellContent(column, item, value)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Non-virtualized rendering (default)
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-stone-200 dark:border-neutral-700", className)}>
      <table className="table-pro w-full">
        {tableHeader}
        <tbody className="divide-y divide-stone-100 dark:divide-neutral-700 bg-white dark:bg-neutral-900">
          {data.map((item, rowIndex) => renderRow(item, rowIndex))}
        </tbody>
      </table>
    </div>
  );
}

export const ProDataTable = React.memo(ProDataTableInner) as <T>(
  props: ProDataTableProps<T>
) => React.ReactNode;

export default ProDataTable;
