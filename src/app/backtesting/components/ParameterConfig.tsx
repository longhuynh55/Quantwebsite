import { Input, Select } from "@/components/ui";
import { PARAM_LABELS, ADVANCED_CONFIG_PRESETS } from "../constants";
import { StrategyConfig } from "../types";

interface StrategyParamsProps {
  strategyParams: Record<string, string>;
  onStrategyParamChange: (key: string, value: string) => void;
}

export function StrategyParams({ strategyParams, onStrategyParamChange }: StrategyParamsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50/30 dark:bg-slate-900/30 rounded-2xl border border-gray-100 dark:border-slate-800">
      {Object.entries(strategyParams).map(([key, value]) => (
        <div key={key} className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest px-1">
            {PARAM_LABELS[key] ?? key}
          </label>
          <Input
            type="number"
            value={value}
            className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl text-xs font-mono"
            onChange={(e) => onStrategyParamChange(key, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}

interface ExecutionConfigProps {
  config: StrategyConfig;
  onConfigChange: (updates: Partial<StrategyConfig>) => void;
  onPresetApply: (presetKey: "low_cost" | "realistic" | "stress") => void;
}

export function ExecutionConfig({ config, onConfigChange, onPresetApply }: ExecutionConfigProps) {
  return (
    <div className="space-y-4 p-4 bg-gray-50/30 dark:bg-slate-900/30 rounded-2xl border border-gray-100 dark:border-slate-800">
      <div className="flex flex-wrap gap-2 mb-2">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center mr-2 px-1">
          Presets:
        </span>
        {ADVANCED_CONFIG_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className="h-7 text-[10px] font-bold rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            onClick={() => onPresetApply(preset.key)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest px-1">
            Execution Model
          </label>
          <Select
            value={config.executionModel}
            className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl text-xs"
            onChange={(e) =>
              onConfigChange({ executionModel: e.target.value as "next_open" | "same_close" })
            }
            options={[
              { value: "next_open", label: "T+1 Open" },
              { value: "same_close", label: "T Close" },
            ]}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest px-1">
            Fee (bps)
          </label>
          <Input
            type="number"
            value={config.feeBps}
            className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl text-xs font-mono"
            onChange={(e) => onConfigChange({ feeBps: e.target.value })}
            min="0"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest px-1">
            Tax (bps)
          </label>
          <Input
            type="number"
            value={config.sellTaxBps}
            className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl text-xs font-mono"
            onChange={(e) => onConfigChange({ sellTaxBps: e.target.value })}
            min="0"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest px-1">
            Slippage (bps)
          </label>
          <Input
            type="number"
            value={config.slippageBps}
            className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl text-xs font-mono"
            onChange={(e) => onConfigChange({ slippageBps: e.target.value })}
            min="0"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-500 dark:text-slate-500 uppercase tracking-widest px-1">
            Lot Size
          </label>
          <Input
            type="number"
            value={config.lotSize}
            className="bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-xl text-xs font-mono"
            onChange={(e) => onConfigChange({ lotSize: e.target.value })}
            min="1"
          />
        </div>
      </div>
    </div>
  );
}
