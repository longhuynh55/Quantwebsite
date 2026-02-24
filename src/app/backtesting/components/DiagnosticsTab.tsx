import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { Info } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { getExecutionModelLabel } from "../constants";
import { BacktestResult } from "../types";

interface DiagnosticsTabProps {
  result: BacktestResult;
}

export function DiagnosticsTab({ result }: DiagnosticsTabProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="overflow-hidden border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="h-px bg-emerald-700 dark:bg-emerald-500" />
        <CardHeader className="border-b border-stone-200 pb-4 dark:border-neutral-800">
          <CardTitle className="font-serif text-base font-semibold text-stone-900 dark:text-white">Execution Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-neutral-400">Execution Model</p>
                <p className="text-sm font-medium text-stone-900 dark:text-neutral-100">
                  {getExecutionModelLabel(result.configApplied?.executionModel)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-neutral-400">Initial Capital</p>
                <p className="text-sm font-medium text-stone-900 dark:text-neutral-100">{formatCurrency(result.initialCapital)}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-stone-200 dark:border-neutral-800">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-neutral-400">Cost Structure</p>
              <div className="flex flex-wrap gap-4">
                <Badge variant="outline" className="border-stone-300 text-stone-700 dark:border-neutral-700 dark:text-neutral-300">
                  Fee: {result.configApplied?.costs?.feeBps ?? 0} bps
                </Badge>
                <Badge variant="outline" className="border-stone-300 text-stone-700 dark:border-neutral-700 dark:text-neutral-300">
                  Tax: {result.configApplied?.costs?.sellTaxBps ?? 0} bps
                </Badge>
                <Badge variant="outline" className="border-stone-300 text-stone-700 dark:border-neutral-700 dark:text-neutral-300">
                  Slippage: {result.configApplied?.costs?.slippageBps ?? 0} bps
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-stone-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="h-px bg-emerald-700 dark:bg-emerald-500" />
        <CardHeader className="border-b border-stone-200 pb-4 dark:border-neutral-800">
          <CardTitle className="font-serif text-base font-semibold text-stone-900 dark:text-white">Data Quality Diagnostics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="border border-stone-200 bg-stone-50 p-2 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400 dark:text-neutral-500">Usable</p>
                <p className="text-sm font-semibold text-stone-900 dark:text-neutral-100">{result.diagnostics?.usableRows ?? 0}</p>
              </div>
              <div className="border border-stone-200 bg-stone-50 p-2 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400 dark:text-neutral-500">Coverage</p>
                <p className="text-sm font-semibold text-stone-900 dark:text-neutral-100">
                  {formatPercent(result.diagnostics?.coverageRatio ?? 0)}
                </p>
              </div>
              <div className="border border-stone-200 bg-stone-50 p-2 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400 dark:text-neutral-500">Max Gap</p>
                <p className="text-sm font-semibold text-stone-900 dark:text-neutral-100">{result.diagnostics?.largestGapDays ?? 0}d</p>
              </div>
            </div>

            {Array.isArray(result.diagnostics?.warnings) && result.diagnostics.warnings.length > 0 && (
              <div className="mt-4 border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/40 dark:bg-amber-900/10">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700 dark:text-amber-500">
                    System Warnings
                  </span>
                </div>
                <ul className="space-y-1">
                  {result.diagnostics.warnings.map((warning, index) => (
                    <li
                      key={index}
                      className="text-[10px] text-amber-600/80 dark:text-amber-500/80 leading-tight"
                    >
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
