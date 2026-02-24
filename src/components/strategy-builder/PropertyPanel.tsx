"use client";

import { memo } from "react";
import type { ChangeEvent, ElementType } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Database,
  Activity,
  Filter,
  ArrowUpCircle,
  BarChart2,
  Scale,
  GitBranch,
  ArrowDownUp,
  Sigma,
  Trash2,
  X,
} from "lucide-react";
import type {
  AdvancedNodeConfigValue,
  AdvancedNodeType,
  StrategyNodeData,
  StrategyNode,
  DataSourceNodeData,
  IndicatorNodeData,
  FilterNodeData,
  SignalNodeData,
  OutputNodeData,
} from "@/lib/stores/strategyBuilderStore";

interface PropertyPanelProps {
  selectedNode: StrategyNode | null;
  onUpdateNode: (nodeId: string, data: Partial<StrategyNodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
  onClose: () => void;
  className?: string;
}

type DataSourceNode = Extract<StrategyNodeData, { type: "dataSource" }>;
type IndicatorNode = Extract<StrategyNodeData, { type: "indicator" }>;
type FilterNode = Extract<StrategyNodeData, { type: "filter" }>;
type SignalNode = Extract<StrategyNodeData, { type: "signal" }>;
type OutputNode = Extract<StrategyNodeData, { type: "output" }>;
type AdvancedNode = Extract<StrategyNodeData, { type: AdvancedNodeType }>;

const nodeIcons: Partial<Record<StrategyNodeData["type"], ElementType>> = {
  dataSource: Database,
  indicator: Activity,
  filter: Filter,
  signal: ArrowUpCircle,
  output: BarChart2,
  weighting: Scale,
  conditional: GitBranch,
  sort: ArrowDownUp,
  math: Sigma,
};

const timeframeOptions: Array<{ value: string; label: string }> = [
  { value: "1m", label: "1 Minute" },
  { value: "5m", label: "5 Minutes" },
  { value: "15m", label: "15 Minutes" },
  { value: "1h", label: "1 Hour" },
  { value: "4h", label: "4 Hours" },
  { value: "1d", label: "Daily" },
  { value: "1w", label: "Weekly" },
];

const indicatorOptions: Array<{
  value: IndicatorNodeData["indicatorType"];
  label: string;
}> = [
  { value: "rsi", label: "RSI (Relative Strength Index)" },
  { value: "ma", label: "Moving Average (SMA)" },
  { value: "ema", label: "Exponential Moving Average" },
  { value: "bollinger", label: "Bollinger Bands" },
];
const supportedIndicatorTypes = new Set<IndicatorNodeData["indicatorType"]>(
  indicatorOptions.map((item) => item.value)
);

const filterOptions: Array<{
  value: FilterNodeData["filterType"];
  label: string;
}> = [
  { value: "rsi_overbought", label: "RSI Overbought (>70)" },
  { value: "rsi_oversold", label: "RSI Oversold (<30)" },
];
const supportedFilterTypes = new Set<FilterNodeData["filterType"]>(
  filterOptions.map((item) => item.value)
);

const comparisonOptions: Array<{
  value: FilterNodeData["comparisonOperator"];
  label: string;
}> = [
  { value: ">", label: "Greater Than (>)" },
  { value: "<", label: "Less Than (<)" },
  { value: ">=", label: "Greater or Equal (>=)" },
  { value: "<=", label: "Less or Equal (<=)" },
  { value: "==", label: "Equal (=)" },
  { value: "!=", label: "Not Equal (!=)" },
];

const signalOptions: Array<{
  value: SignalNodeData["signalType"];
  label: string;
}> = [
  { value: "buy", label: "Buy Signal" },
  { value: "sell", label: "Sell Signal" },
];

const metricOptions: Array<{ value: string; label: string }> = [
  { value: "returns", label: "Total Returns" },
  { value: "sharpe", label: "Sharpe Ratio" },
  { value: "drawdown", label: "Max Drawdown" },
  { value: "winrate", label: "Win Rate" },
  { value: "profit", label: "Net Profit" },
  { value: "trades", label: "Total Trades" },
];

const parseIntOr = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseFloatOr = (value: string, fallback: number) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const advancedNodeTypes: AdvancedNodeType[] = ["weighting", "conditional", "sort", "math"];
const propertySelectClass =
  "w-full h-9 px-3 text-sm border border-stone-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500";

const isAdvancedNodeType = (type: StrategyNodeData["type"]): type is AdvancedNodeType =>
  advancedNodeTypes.includes(type as AdvancedNodeType);

export const PropertyPanel = memo(
  ({ selectedNode, onUpdateNode, onDeleteNode, onClose, className }: PropertyPanelProps) => {
    if (!selectedNode) {
      return (
        <div
          className={cn(
            "flex flex-col items-center justify-center h-full p-6 text-center",
            className
          )}
        >
          <div className="mb-4 bg-stone-100 p-4 dark:bg-neutral-800">
            <Activity className="w-8 h-8 text-stone-400 dark:text-neutral-500" />
          </div>
          <h3 className="mb-1 font-serif text-sm font-semibold text-stone-900 dark:text-white">
            No Node Selected
          </h3>
          <p className="text-[11px] text-stone-500 dark:text-neutral-400">
            Click on a node in the canvas to edit its properties
          </p>
        </div>
      );
    }

    const { id, data } = selectedNode;
    const Icon = nodeIcons[data.type] || Activity;

    const updateNodeData = (nextData: Partial<StrategyNodeData>) => {
      onUpdateNode(id, nextData);
    };

    const handleLabelChange = (e: ChangeEvent<HTMLInputElement>) => {
      const nextLabel = e.target.value;
      switch (data.type) {
        case "dataSource": {
          const typed = data as DataSourceNode;
          updateNodeData({ label: nextLabel, config: { ...typed.config, label: nextLabel } });
          return;
        }
        case "indicator": {
          const typed = data as IndicatorNode;
          updateNodeData({ label: nextLabel, config: { ...typed.config, label: nextLabel } });
          return;
        }
        case "filter": {
          const typed = data as FilterNode;
          updateNodeData({ label: nextLabel, config: { ...typed.config, label: nextLabel } });
          return;
        }
        case "signal": {
          const typed = data as SignalNode;
          updateNodeData({ label: nextLabel, config: { ...typed.config, label: nextLabel } });
          return;
        }
        case "output": {
          const typed = data as OutputNode;
          updateNodeData({ label: nextLabel, config: { ...typed.config, label: nextLabel } });
          return;
        }
        default: {
          const typed = data as AdvancedNode;
          updateNodeData({ label: nextLabel, config: { ...typed.config, label: nextLabel } });
        }
      }
    };

    const renderDataSourceConfig = (nodeData: DataSourceNode) => {
      const config = nodeData.config;

      return (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-neutral-300 mb-1.5">
              Stocks
            </label>
            <div className="flex flex-wrap gap-1.5 p-2 min-h-[38px] border border-stone-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 rounded-md focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all">
              {config.stocks.map((symbol, idx) => (
                <span
                  key={`${symbol}-${idx}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                >
                  {symbol}
                  <button
                    type="button"
                    onClick={() => {
                      const nextStocks = config.stocks.filter((_, i) => i !== idx);
                      const nextConfig: DataSourceNodeData = {
                        ...config,
                        label: nodeData.label,
                        stocks: nextStocks,
                      };
                      updateNodeData({ ...nodeData, config: nextConfig });
                    }}
                    className="ml-0.5 text-emerald-400 hover:text-rose-500 dark:text-emerald-500 dark:hover:text-rose-400 transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder={config.stocks.length === 0 ? "Type symbol + Enter" : "Add..."}
                className="flex-1 min-w-[60px] text-sm bg-transparent outline-none text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-neutral-500"
                onKeyDown={(e) => {
                  const input = e.currentTarget;
                  const val = input.value.trim().toUpperCase();
                  if ((e.key === "Enter" || e.key === "," || e.key === " ") && val) {
                    e.preventDefault();
                    const newSymbols = val.split(/[,\s]+/).filter(Boolean);
                    const uniqueStocks = [...new Set([...config.stocks, ...newSymbols])];
                    const nextConfig: DataSourceNodeData = {
                      ...config,
                      label: nodeData.label,
                      stocks: uniqueStocks,
                    };
                    updateNodeData({ ...nodeData, config: nextConfig });
                    input.value = "";
                  } else if (e.key === "Backspace" && !input.value && config.stocks.length > 0) {
                    const nextConfig: DataSourceNodeData = {
                      ...config,
                      label: nodeData.label,
                      stocks: config.stocks.slice(0, -1),
                    };
                    updateNodeData({ ...nodeData, config: nextConfig });
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData("text").toUpperCase();
                  const newSymbols = pasted.split(/[,\s]+/).filter(Boolean);
                  const uniqueStocks = [...new Set([...config.stocks, ...newSymbols])];
                  const nextConfig: DataSourceNodeData = {
                    ...config,
                    label: nodeData.label,
                    stocks: uniqueStocks,
                  };
                  updateNodeData({ ...nodeData, config: nextConfig });
                }}
              />
            </div>
            <p className="mt-1 text-[10px] text-stone-400 dark:text-neutral-500">
              Press Enter, comma, or space to add • Backspace to remove
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-neutral-300 mb-1.5">
              Timeframe
            </label>
            <select
              value={config.timeframe || "1d"}
              onChange={(e) => {
                const nextConfig: DataSourceNodeData = {
                  ...config,
                  label: nodeData.label,
                  timeframe: e.target.value,
                };

                updateNodeData({ ...nodeData, config: nextConfig });
              }}
              className={propertySelectClass}
            >
              {timeframeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-neutral-300 mb-1.5">
                Start Date
              </label>
              <Input
                type="date"
                value={config.startDate || ""}
                onChange={(e) => {
                  const nextConfig: DataSourceNodeData = {
                    ...config,
                    label: nodeData.label,
                    startDate: e.target.value,
                  };

                  updateNodeData({ ...nodeData, config: nextConfig });
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-neutral-300 mb-1.5">
                End Date
              </label>
              <Input
                type="date"
                value={config.endDate || ""}
                onChange={(e) => {
                  const nextConfig: DataSourceNodeData = {
                    ...config,
                    label: nodeData.label,
                    endDate: e.target.value,
                  };

                  updateNodeData({ ...nodeData, config: nextConfig });
                }}
              />
            </div>
          </div>
        </div>
      );
    };

    const renderIndicatorConfig = (nodeData: IndicatorNode) => {
      const config = nodeData.config;
      const hasSupportedIndicator = supportedIndicatorTypes.has(config.indicatorType);

      return (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-neutral-300 mb-1.5">
              Indicator Type
            </label>
            <select
              value={hasSupportedIndicator ? config.indicatorType : ""}
              onChange={(e) => {
                const nextConfig: IndicatorNodeData = {
                  ...config,
                  label: nodeData.label,
                  indicatorType: e.target.value as IndicatorNodeData["indicatorType"],
                };

                updateNodeData({ ...nodeData, config: nextConfig });
              }}
              className={propertySelectClass}
            >
              {!hasSupportedIndicator && (
                <option value="" disabled>
                  Select a supported indicator
                </option>
              )}
              {indicatorOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {!hasSupportedIndicator && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                This indicator is not supported in Template Tuner mode.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-neutral-300 mb-1.5">
              Period
            </label>
            <Input
              type="number"
              min={1}
              value={config.period || 14}
              onChange={(e) => {
                const nextConfig: IndicatorNodeData = {
                  ...config,
                  label: nodeData.label,
                  period: parseIntOr(e.target.value, 14),
                };

                updateNodeData({ ...nodeData, config: nextConfig });
              }}
            />
          </div>

          {config.indicatorType === "bollinger" && (
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-neutral-300 mb-1.5">
                Standard Deviations
              </label>
              <Input
                type="number"
                min={0.5}
                step={0.5}
                value={config.standardDeviations || 2}
                onChange={(e) => {
                  const nextConfig: IndicatorNodeData = {
                    ...config,
                    label: nodeData.label,
                    standardDeviations: parseFloatOr(e.target.value, 2),
                  };

                  updateNodeData({ ...nodeData, config: nextConfig });
                }}
              />
            </div>
          )}
        </div>
      );
    };

    const renderFilterConfig = (nodeData: FilterNode) => {
      const config = nodeData.config;
      const hasSupportedFilter = supportedFilterTypes.has(config.filterType);

      return (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-neutral-300 mb-1.5">
              Filter Type
            </label>
            <select
              value={hasSupportedFilter ? config.filterType : ""}
              onChange={(e) => {
                const nextConfig: FilterNodeData = {
                  ...config,
                  label: nodeData.label,
                  filterType: e.target.value as FilterNodeData["filterType"],
                };

                updateNodeData({ ...nodeData, config: nextConfig });
              }}
              className={propertySelectClass}
            >
              {!hasSupportedFilter && (
                <option value="" disabled>
                  Select a supported filter
                </option>
              )}
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {!hasSupportedFilter && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                This filter is not supported in Template Tuner mode.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-neutral-300 mb-1.5">
              Comparison
            </label>
            <select
              value={config.comparisonOperator || ">"}
              onChange={(e) => {
                const nextConfig: FilterNodeData = {
                  ...config,
                  label: nodeData.label,
                  comparisonOperator: e.target.value as FilterNodeData["comparisonOperator"],
                };

                updateNodeData({ ...nodeData, config: nextConfig });
              }}
              className={propertySelectClass}
            >
              {comparisonOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-neutral-300 mb-1.5">
              Value
            </label>
            <Input
              type="number"
              step="any"
              value={config.value || 0}
              onChange={(e) => {
                const nextConfig: FilterNodeData = {
                  ...config,
                  label: nodeData.label,
                  value: parseFloatOr(e.target.value, 0),
                };

                updateNodeData({ ...nodeData, config: nextConfig });
              }}
            />
          </div>
        </div>
      );
    };

    const renderSignalConfig = (nodeData: SignalNode) => {
      const config = nodeData.config;

      return (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-neutral-300 mb-1.5">
              Signal Type
            </label>
            <select
              value={config.signalType || "buy"}
              onChange={(e) => {
                const nextConfig: SignalNodeData = {
                  ...config,
                  label: nodeData.label,
                  signalType: e.target.value as SignalNodeData["signalType"],
                };

                updateNodeData({ ...nodeData, config: nextConfig });
              }}
              className={propertySelectClass}
            >
              {signalOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-neutral-300 mb-1.5">
              Quantity
            </label>
            <Input
              type="number"
              min={1}
              value={config.quantity || 100}
              onChange={(e) => {
                const nextConfig: SignalNodeData = {
                  ...config,
                  label: nodeData.label,
                  quantity: parseIntOr(e.target.value, 100),
                };

                updateNodeData({ ...nodeData, config: nextConfig });
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-neutral-300 mb-1.5">
                Stop Loss (%)
              </label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={config.stopLoss || ""}
                onChange={(e) => {
                  const parsed = Number.parseFloat(e.target.value);
                  const nextConfig: SignalNodeData = {
                    ...config,
                    label: nodeData.label,
                    stopLoss: Number.isFinite(parsed) ? parsed : undefined,
                  };

                  updateNodeData({ ...nodeData, config: nextConfig });
                }}
                placeholder="5"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-neutral-300 mb-1.5">
                Take Profit (%)
              </label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={config.takeProfit || ""}
                onChange={(e) => {
                  const parsed = Number.parseFloat(e.target.value);
                  const nextConfig: SignalNodeData = {
                    ...config,
                    label: nodeData.label,
                    takeProfit: Number.isFinite(parsed) ? parsed : undefined,
                  };

                  updateNodeData({ ...nodeData, config: nextConfig });
                }}
                placeholder="10"
              />
            </div>
          </div>
        </div>
      );
    };

    const renderOutputConfig = (nodeData: OutputNode) => {
      const config = nodeData.config;
      const selectedMetrics = config.metrics || ["returns", "sharpe"];

      const handleMetricToggle = (metric: string) => {
        const newMetrics = selectedMetrics.includes(metric)
          ? selectedMetrics.filter((m) => m !== metric)
          : [...selectedMetrics, metric];

        const nextConfig: OutputNodeData = {
          ...config,
          label: nodeData.label,
          metrics: newMetrics,
        };

        updateNodeData({ ...nodeData, config: nextConfig });
      };

      return (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-neutral-300 mb-2">
              Metrics to Display
            </label>
            <div className="space-y-2">
              {metricOptions.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 dark:border-neutral-700 hover:bg-stone-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedMetrics.includes(opt.value)}
                    onChange={() => handleMetricToggle(opt.value)}
                    className="w-4 h-4 text-emerald-600 rounded border-stone-300 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-stone-700 dark:text-neutral-300">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      );
    };

    const updateAdvancedConfig = (
      nodeData: AdvancedNode,
      key: string,
      value: AdvancedNodeConfigValue
    ) => {
      updateNodeData({
        ...nodeData,
        config: {
          ...nodeData.config,
          label: nodeData.label,
          [key]: value,
        },
      });
    };

    const renderAdvancedConfig = (nodeData: AdvancedNode) => {
      const entries = Object.entries(nodeData.config ?? {}).filter(
        ([key]) => key !== "label"
      );

      if (entries.length === 0) {
        return (
          <p className="text-xs text-stone-500 dark:text-neutral-400">
            No additional config for this node type.
          </p>
        );
      }

      return (
        <div className="space-y-4">
          {entries.map(([key, rawValue]) => {
            const label = key
              .replace(/_/g, " ")
              .replace(/([a-z])([A-Z])/g, "$1 $2")
              .replace(/^./, (char) => char.toUpperCase());

            if (typeof rawValue === "string") {
              return (
                <div key={key}>
                  <label className="block text-xs font-medium text-stone-700 dark:text-neutral-300 mb-1.5">
                    {label}
                  </label>
                  <Input
                    value={rawValue}
                    onChange={(event) =>
                      updateAdvancedConfig(nodeData, key, event.target.value)
                    }
                  />
                </div>
              );
            }

            if (typeof rawValue === "number") {
              return (
                <div key={key}>
                  <label className="block text-xs font-medium text-stone-700 dark:text-neutral-300 mb-1.5">
                    {label}
                  </label>
                  <Input
                    type="number"
                    step="any"
                    value={rawValue}
                    onChange={(event) =>
                      updateAdvancedConfig(
                        nodeData,
                        key,
                        parseFloatOr(event.target.value, rawValue)
                      )
                    }
                  />
                </div>
              );
            }

            if (typeof rawValue === "boolean") {
              return (
                <label
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-stone-200 dark:border-neutral-700 px-3 py-2"
                >
                  <span className="text-sm text-stone-700 dark:text-neutral-300">{label}</span>
                  <input
                    type="checkbox"
                    checked={rawValue}
                    onChange={(event) =>
                      updateAdvancedConfig(nodeData, key, event.target.checked)
                    }
                    className="w-4 h-4 text-emerald-600 rounded border-stone-300 focus:ring-emerald-500"
                  />
                </label>
              );
            }

            return (
              <div key={key}>
                <label className="block text-xs font-medium text-stone-700 dark:text-neutral-300 mb-1.5">
                  {label}
                </label>
                <textarea
                  readOnly
                  className="w-full rounded-md border border-stone-300 dark:border-neutral-600 bg-stone-100 dark:bg-neutral-800 px-3 py-2 text-xs text-stone-700 dark:text-neutral-200"
                  rows={3}
                  value={JSON.stringify(rawValue, null, 2)}
                />
              </div>
            );
          })}
        </div>
      );
    };

    const renderConfig = () => {
      switch (data.type) {
        case "dataSource":
          return renderDataSourceConfig(data);
        case "indicator":
          return renderIndicatorConfig(data);
        case "filter":
          return renderFilterConfig(data);
        case "signal":
          return renderSignalConfig(data);
        case "output":
          return renderOutputConfig(data);
        default:
          if (isAdvancedNodeType(data.type)) {
            return renderAdvancedConfig(data);
          }
          return null;
      }
    };

    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="border-b border-stone-200 px-4 py-3 dark:border-neutral-700">
          <div className="mb-2 h-px w-8 bg-emerald-700 dark:bg-emerald-500" />
          <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-100 p-1.5 dark:bg-emerald-900/50">
              <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="font-serif text-sm font-semibold text-stone-900 dark:text-white">
              Properties
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-stone-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close properties panel"
          >
            <X className="w-4 h-4 text-stone-500 dark:text-neutral-400" />
          </button>
        </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4">
            <label className="block text-xs font-medium text-stone-700 dark:text-neutral-300 mb-1.5">
              Node Label
            </label>
            <Input value={data.label} onChange={handleLabelChange} placeholder="Enter label..." />
          </div>

          {renderConfig()}
        </div>

        <div className="px-4 py-3 border-t border-stone-200 dark:border-neutral-700">
          <Button
            variant="outline"
            size="sm"
            className="w-full border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:border-rose-800 dark:hover:bg-rose-950/40"
            onClick={() => onDeleteNode(id)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Node
          </Button>
        </div>
      </div>
    );
  }
);

PropertyPanel.displayName = "PropertyPanel";
