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
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold">Execution Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase">Execution Model</p>
                <p className="text-sm font-medium">
                  {getExecutionModelLabel(result.configApplied?.executionModel)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase">Initial Capital</p>
                <p className="text-sm font-medium">{formatCurrency(result.initialCapital)}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
              <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Cost Structure</p>
              <div className="flex flex-wrap gap-4">
                <Badge variant="outline">
                  Fee: {result.configApplied?.costs?.feeBps ?? 0} bps
                </Badge>
                <Badge variant="outline">
                  Tax: {result.configApplied?.costs?.sellTaxBps ?? 0} bps
                </Badge>
                <Badge variant="outline">
                  Slippage: {result.configApplied?.costs?.slippageBps ?? 0} bps
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold">Data Quality Diagnostics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Usable</p>
                <p className="text-sm font-bold">{result.diagnostics?.usableRows ?? 0}</p>
              </div>
              <div className="p-2 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Coverage</p>
                <p className="text-sm font-bold">
                  {formatPercent(result.diagnostics?.coverageRatio ?? 0)}
                </p>
              </div>
              <div className="p-2 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Max Gap</p>
                <p className="text-sm font-bold">{result.diagnostics?.largestGapDays ?? 0}d</p>
              </div>
            </div>

            {Array.isArray(result.diagnostics?.warnings) && result.diagnostics.warnings.length > 0 && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-500">
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
