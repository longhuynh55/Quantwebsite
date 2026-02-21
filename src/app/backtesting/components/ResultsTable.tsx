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
              <span className="text-gray-900 dark:text-slate-200 font-bold">
                {formatCurrency(t.entryPrice)}
              </span>
              <span className="text-gray-500">{formatCurrency(t.exitPrice)}</span>
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
            <Badge variant={t.pnlPercent >= 0 ? "success" : "destructive"} className="font-mono">
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
                t.pnl >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
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
            <span className="text-xs text-gray-400 font-mono">{formatCurrency(t.totalCosts)}</span>
          ),
          width: "15%",
        },
      ]}
      height="600px"
    />
  );
}
