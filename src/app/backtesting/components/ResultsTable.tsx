import { DataTable, Badge } from "@/components/ui";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";
import { Trade } from "@/lib/quant/backtest";
import { BacktestResult } from "../types";

interface ResultsTableProps {
  result: BacktestResult;
  symbol: string;
}

export function ResultsTable({ result, symbol }: ResultsTableProps) {
  return (
    <DataTable<Trade>
      data={(result.trades ?? []).map((trade) => ({ ...trade, symbol }))}
      columns={[
        {
          header: "Entry Date",
          accessorKey: "entryDate",
          sortable: true,
          cell: (t: Trade) => (
            <span className="text-xs font-mono">{new Date(t.entryDate).toLocaleDateString()}</span>
          ),
          width: "15%",
        },
        {
          header: "Exit Date",
          accessorKey: "exitDate",
          sortable: true,
          cell: (t: Trade) => (
            <span className="text-xs font-mono">{new Date(t.exitDate).toLocaleDateString()}</span>
          ),
          width: "15%",
        },
        {
          header: "Entry/Exit",
          accessorKey: "prices",
          cell: (t: Trade) => (
            <div className="flex flex-col text-[10px]">
              <span className="font-bold text-stone-900 dark:text-white">
                {formatCurrency(t.entryPrice)}
              </span>
              <span className="text-stone-500 dark:text-neutral-400">{formatCurrency(t.exitPrice)}</span>
            </div>
          ),
          width: "15%",
        },
        {
          header: "PnL (%)",
          accessorKey: "pnlPercent",
          sortable: true,
          align: "right",
          cell: (t: Trade) => (
            <Badge
              variant="outline"
              className={cn(
                "font-mono",
                t.pnlPercent >= 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
              )}
            >
              {t.pnlPercent >= 0 ? "+" : ""}
              {formatPercent(t.pnlPercent)}
            </Badge>
          ),
          width: "15%",
        },
        {
          header: "PnL (Abs)",
          accessorKey: "pnl",
          sortable: true,
          align: "right",
          cell: (t: Trade) => (
            <span
              className={cn(
                "font-mono text-xs font-bold",
                t.pnl >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"
              )}
            >
              {t.pnl >= 0 ? "+" : ""}
              {formatCurrency(t.pnl)}
            </span>
          ),
          width: "15%",
        },
        {
          header: "Costs",
          accessorKey: "totalCosts",
          align: "right",
          cell: (t: Trade) => (
            <span className="font-mono text-xs text-stone-400 dark:text-neutral-500">{formatCurrency(t.totalCosts)}</span>
          ),
          width: "15%",
        },
      ]}
      height="600px"
    />
  );
}
