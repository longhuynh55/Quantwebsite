import { Input, Select } from "@/components/ui";
import { PARAM_LABELS, ADVANCED_CONFIG_PRESETS } from "../constants";
import { StrategyConfig } from "../types";

interface StrategyParamsProps {
  strategyParams: Record<string, string>;
  onStrategyParamChange: (key: string, value: string) => void;
}

export function StrategyParams({ strategyParams, onStrategyParamChange }: StrategyParamsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 border border-stone-200 bg-stone-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/60 sm:grid-cols-2 lg:grid-cols-4">
      {Object.entries(strategyParams).map(([key, value]) => (
        <div key={key} className="space-y-1.5">
          <label className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-neutral-500">
            {PARAM_LABELS[key] ?? key}
          </label>
          <Input
            type="number"
            value={value}
            className="border-stone-200 bg-white text-xs font-mono dark:border-neutral-700 dark:bg-neutral-950"
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
    <div className="space-y-4 border border-stone-200 bg-stone-50/70 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex flex-wrap gap-2 mb-2">
        <span className="mr-2 flex items-center px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-neutral-500">
          Presets:
        </span>
        {ADVANCED_CONFIG_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className="h-7 border border-stone-300 bg-white px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-stone-700 transition-colors hover:border-stone-400 hover:bg-stone-100 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
            onClick={() => onPresetApply(preset.key)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="space-y-1.5">
          <label className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-neutral-500">
            Execution Model
          </label>
          <Select
            value={config.executionModel}
            className="border-stone-200 bg-white text-xs dark:border-neutral-700 dark:bg-neutral-950"
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
          <label className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-neutral-500">
            Fee (bps)
          </label>
          <Input
            type="number"
            value={config.feeBps}
            className="border-stone-200 bg-white text-xs font-mono dark:border-neutral-700 dark:bg-neutral-950"
            onChange={(e) => onConfigChange({ feeBps: e.target.value })}
            min="0"
          />
        </div>
        <div className="space-y-1.5">
          <label className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-neutral-500">
            Tax (bps)
          </label>
          <Input
            type="number"
            value={config.sellTaxBps}
            className="border-stone-200 bg-white text-xs font-mono dark:border-neutral-700 dark:bg-neutral-950"
            onChange={(e) => onConfigChange({ sellTaxBps: e.target.value })}
            min="0"
          />
        </div>
        <div className="space-y-1.5">
          <label className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-neutral-500">
            Slippage (bps)
          </label>
          <Input
            type="number"
            value={config.slippageBps}
            className="border-stone-200 bg-white text-xs font-mono dark:border-neutral-700 dark:bg-neutral-950"
            onChange={(e) => onConfigChange({ slippageBps: e.target.value })}
            min="0"
          />
        </div>
        <div className="space-y-1.5">
          <label className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500 dark:text-neutral-500">
            Lot Size
          </label>
          <Input
            type="number"
            value={config.lotSize}
            className="border-stone-200 bg-white text-xs font-mono dark:border-neutral-700 dark:bg-neutral-950"
            onChange={(e) => onConfigChange({ lotSize: e.target.value })}
            min="1"
          />
        </div>
      </div>
    </div>
  );
}
