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
  Trash2,
  X,
} from "lucide-react";
import type {
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

const nodeIcons: Partial<Record<StrategyNodeData["type"], ElementType>> = {
  dataSource: Database,
  indicator: Activity,
  filter: Filter,
  signal: ArrowUpCircle,
  output: BarChart2,
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
          <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
            <Activity className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
            No Node Selected
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Click on a node in the canvas to edit its properties
          </p>
        </div>
      );
    }

    const { id, data } = selectedNode;
    const Icon = nodeIcons[data.type] || Activity;

    const updateNodeData = (nextData: StrategyNodeData) => {
      onUpdateNode(id, nextData);
    };

    const handleLabelChange = (e: ChangeEvent<HTMLInputElement>) => {
      const nextLabel = e.target.value;
      switch (data.type) {
        case "dataSource":
          updateNodeData({
            ...data,
            label: nextLabel,
            config: { ...data.config, label: nextLabel },
          });
          break;
        case "indicator":
          updateNodeData({
            ...data,
            label: nextLabel,
            config: { ...data.config, label: nextLabel },
          });
          break;
        case "filter":
          updateNodeData({
            ...data,
            label: nextLabel,
            config: { ...data.config, label: nextLabel },
          });
          break;
        case "signal":
          updateNodeData({
            ...data,
            label: nextLabel,
            config: { ...data.config, label: nextLabel },
          });
          break;
        case "output":
          updateNodeData({
            ...data,
            label: nextLabel,
            config: { ...data.config, label: nextLabel },
          });
          break;
        default:
          break;
      }
    };

    const renderDataSourceConfig = (nodeData: DataSourceNode) => {
      const config = nodeData.config;

      return (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Stocks (comma-separated)
            </label>
            <Input
              value={config.stocks.join(", ")}
              onChange={(e) => {
                const nextConfig: DataSourceNodeData = {
                  ...config,
                  label: nodeData.label,
                  stocks: e.target.value
                    .split(",")
                    .map((symbol) => symbol.trim())
                    .filter(Boolean),
                };

                updateNodeData({ ...nodeData, config: nextConfig });
              }}
              placeholder="e.g., VNM, VIC, FPT"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
              className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
              className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
              className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
              className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {comparisonOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
              className="w-full h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {signalOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              Metrics to Display
            </label>
            <div className="space-y-2">
              {metricOptions.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedMetrics.includes(opt.value)}
                    onChange={() => handleMetricToggle(opt.value)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
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
          return null;
      }
    };

    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-md">
              <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Properties
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close properties panel"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Node Label
            </label>
            <Input value={data.label} onChange={handleLabelChange} placeholder="Enter label..." />
          </div>

          {renderConfig()}
        </div>

        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
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
